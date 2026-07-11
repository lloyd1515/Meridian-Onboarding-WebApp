import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, RoleChecker
from app.models import Employee, ChecklistTask, ScheduleEntry
from app.schemas import EmployeeOut, BackupEmployeeInput, EmployeeUpdate, BuddyViewResponse, BuddyViewEntry, BuddyStuckTask
from uuid import UUID
from app.core.security import hash_password
from app.core.checklist_templates import seed_checklist_tasks

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("/me", response_model=EmployeeOut)
async def get_me(current_user: Employee = Depends(get_current_user)):
    return current_user

def _ics_escape(text: str) -> str:
    """Escape text per RFC 5545 (section 3.3.11)."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )

@router.get("/me/agenda.ics")
async def get_my_agenda_ics(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    """Exports the current user's first-week agenda (office/remote days plus
    a focus task per day) as a downloadable .ics calendar file, so they can
    import it into their own calendar app. Mirrors the same office/remote +
    focus-task-per-day agenda shown on the dashboard's "This Week's Agenda"."""
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    week_dates = [monday + datetime.timedelta(days=i) for i in range(5)]

    schedule_stmt = select(ScheduleEntry).where(
        ScheduleEntry.employee_id == current_user.id,
        ScheduleEntry.date.in_(week_dates),
    )
    schedule_result = await db.execute(schedule_stmt)
    office_dates = {
        e.date for e in schedule_result.scalars().all() if e.status == "office"
    }

    tasks_stmt = (
        select(ChecklistTask)
        .where(
            ChecklistTask.employee_id == current_user.id,
            ChecklistTask.status.in_(["pending", "in_progress"]),
        )
        .order_by(ChecklistTask.due_date.asc(), ChecklistTask.title.asc())
    )
    tasks_result = await db.execute(tasks_stmt)
    open_tasks = tasks_result.scalars().all()

    dtstamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meridian Onboarding//Agenda Export//EN"]

    for idx, day in enumerate(week_dates):
        is_office = day in office_dates
        tasks_due_today = [t for t in open_tasks if t.due_date == day]
        if tasks_due_today:
            focus_task = tasks_due_today[0]
        elif open_tasks:
            focus_task = open_tasks[idx % len(open_tasks)]
        else:
            focus_task = None

        summary = f"Meridian Onboarding — {'In Office' if is_office else 'Remote'}"
        description = f'Focus task: "{focus_task.title}"' if focus_task else "Checklist is all caught up."

        day_str = day.strftime("%Y%m%d")
        next_day_str = (day + datetime.timedelta(days=1)).strftime("%Y%m%d")

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{current_user.id}-{day_str}@meridian-onboarding",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART;VALUE=DATE:{day_str}",
            f"DTEND;VALUE=DATE:{next_day_str}",
            f"SUMMARY:{_ics_escape(summary)}",
            f"DESCRIPTION:{_ics_escape(description)}",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines) + "\r\n"

    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=\"agenda.ics\""},
    )

@router.get("/me/buddy-view", response_model=BuddyViewResponse)
async def get_buddy_view(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # Any employee referenced as someone else's buddy_id -- the "buddies"
    # backref on Employee (models.py) is the other side of that self-FK.
    # There is no separate "buddy" role: a buddy is just an employee looked
    # up this way.
    stmt = (
        select(Employee)
        .where(Employee.buddy_id == current_user.id)
        .options(selectinload(Employee.tasks))
        .order_by(Employee.name)
    )
    result = await db.execute(stmt)
    hires = result.scalars().all()

    today = datetime.date.today()
    entries = []
    for hire in hires:
        stuck_tasks = [
            BuddyStuckTask(id=t.id, title=t.title, status=t.status, due_date=t.due_date)
            for t in hire.tasks
            if t.status == "blocked" or (t.due_date is not None and t.due_date < today and t.status != "completed")
        ]
        entries.append(BuddyViewEntry(
            employee=hire,
            stuck_tasks=stuck_tasks,
            total_tasks=len(hire.tasks),
            completed_tasks=sum(1 for t in hire.tasks if t.status == "completed"),
        ))

    return BuddyViewResponse(hires=entries)

@router.get("", response_model=List[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin", "employee"]))
):
    stmt = select(Employee).order_by(Employee.name)
    result = await db.execute(stmt)
    employees = result.scalars().all()
    return employees

@router.post("", response_model=EmployeeOut)
async def save_employee(
    emp_data: BackupEmployeeInput,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"]))
):
    stmt = select(Employee).where(Employee.id == emp_data.id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.name = emp_data.name
        existing.email = emp_data.email
        existing.slack_handle = emp_data.slack_handle
        existing.role = emp_data.role
        existing.department = emp_data.department
        existing.hire_date = emp_data.hire_date
        existing.buddy_id = emp_data.buddy_id
        existing.hybrid_preference = emp_data.hybrid_preference
        existing.assigned_desk = emp_data.assigned_desk
        if emp_data.hashed_password:
            existing.hashed_password = emp_data.hashed_password
    else:
        new_emp = Employee(
            id=emp_data.id,
            name=emp_data.name,
            email=emp_data.email,
            slack_handle=emp_data.slack_handle,
            role=emp_data.role,
            department=emp_data.department,
            hire_date=emp_data.hire_date,
            buddy_id=emp_data.buddy_id,
            hybrid_preference=emp_data.hybrid_preference,
            assigned_desk=emp_data.assigned_desk,
            hashed_password=emp_data.hashed_password if emp_data.hashed_password.startswith("$argon2id$") else hash_password(emp_data.hashed_password)
        )
        db.add(new_emp)
        await db.flush()
        # This is what makes HR's "Add New Hire" form produce a real,
        # persisted checklist instead of the client-side-only placeholder
        # it silently fell back to before.
        await seed_checklist_tasks(db, new_emp.id, new_emp.department)
    await db.commit()
    
    stmt = select(Employee).where(Employee.id == emp_data.id)
    result = await db.execute(stmt)
    return result.scalar_one()

@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: UUID,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"]))
):
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    updates = payload.model_dump(exclude_unset=True)

    if "buddy_id" in updates and updates["buddy_id"] is not None:
        buddy = await db.get(Employee, updates["buddy_id"])
        if not buddy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Buddy ID {updates['buddy_id']} does not exist."
            )

    for field, value in updates.items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return employee
