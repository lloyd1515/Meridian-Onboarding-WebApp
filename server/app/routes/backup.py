import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text
from app.core.database import get_db
from app.core.dependencies import RoleChecker
from app.models import Employee, ChecklistTask, ScheduleEntry
from app.schemas import BackupPayload

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])

# Endpoint is restricted to hr_admin only
admin_dependency = Depends(RoleChecker(["hr_admin"]))

@router.get("/export", dependencies=[admin_dependency])
async def export_database(db: AsyncSession = Depends(get_db)):
    # Fetch all records from all tables
    employees = (await db.execute(select(Employee))).scalars().all()
    tasks = (await db.execute(select(ChecklistTask))).scalars().all()
    schedules = (await db.execute(select(ScheduleEntry))).scalars().all()
    
    # Format to match backup schema
    exported_employees = []
    for emp in employees:
        exported_employees.append({
            "id": str(emp.id),
            "name": emp.name,
            "email": emp.email,
            "slack_handle": emp.slack_handle,
            "role": emp.role,
            "department": emp.department,
            "hire_date": emp.hire_date.isoformat(),
            "buddy_id": str(emp.buddy_id) if emp.buddy_id else None,
            "hybrid_preference": emp.hybrid_preference,
            "assigned_desk": emp.assigned_desk,
            "hashed_password": emp.hashed_password
        })
        
    exported_tasks = []
    for t in tasks:
        exported_tasks.append({
            "id": str(t.id),
            "employee_id": str(t.employee_id),
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "skip_reason": t.skip_reason,
            "blocked_by": str(t.blocked_by) if t.blocked_by else None,
            "dependencies": t.dependencies,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "milestone_offset_days": t.milestone_offset_days
        })
        
    exported_schedules = []
    for s in schedules:
        exported_schedules.append({
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "date": s.date.isoformat(),
            "status": s.status
        })
        
    return {
        "version": "1.0",
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "employees": exported_employees,
        "checklist_tasks": exported_tasks,
        "schedule_entries": exported_schedules
    }

@router.post("/restore", dependencies=[admin_dependency])
async def restore_database(payload: BackupPayload, db: AsyncSession = Depends(get_db)):
    if payload.version != "1.0":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported backup version: {payload.version}. Expected 1.0."
        )
        
    try:
        # We start a transaction block. Inside FastAPI dependencies, db session is already in a transaction.
        # But we want to lock tables first.
        # 1. Exclusive Table Locks (PostgreSQL only)
        if db.bind.dialect.name == "postgresql":
            await db.execute(text(
                "LOCK TABLE employees, checklist_tasks, schedule_entries IN ACCESS EXCLUSIVE MODE"
            ))
            
        # 2. Truncate Tables Cascade (Order of deletion: child tables first, then parent tables)
        # Note: CASCADE in SQL handles dependencies, but using delete() queries in SQLAlchemy is safer.
        await db.execute(delete(ScheduleEntry))
        await db.execute(delete(ChecklistTask))
        await db.execute(delete(Employee))
        await db.flush()
        
        # 3. Re-populate tables
        # Track inserted entities to check integrity
        employee_map = {}
        for emp_data in payload.employees:
            emp = Employee(
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
                hashed_password=emp_data.hashed_password
            )
            db.add(emp)
            employee_map[emp.id] = emp
            
        await db.flush() # Flush to populate employees first
        
        # Validate foreign keys: buddy_id must exist in employees
        for emp_id, emp in employee_map.items():
            if emp.buddy_id and emp.buddy_id not in employee_map:
                raise ValueError(f"Integrity check failed: Buddy ID {emp.buddy_id} for Employee {emp.name} does not exist.")
                
        # Populate Checklist Tasks
        task_map = {}
        for t_data in payload.checklist_tasks:
            if t_data.employee_id not in employee_map:
                raise ValueError(f"Integrity check failed: Checklist task {t_data.title} points to non-existent employee {t_data.employee_id}.")
                
            task = ChecklistTask(
                id=t_data.id,
                employee_id=t_data.employee_id,
                title=t_data.title,
                description=t_data.description,
                status=t_data.status,
                skip_reason=t_data.skip_reason,
                blocked_by=t_data.blocked_by,
                dependencies=t_data.dependencies,
                due_date=t_data.due_date,
                completed_at=t_data.completed_at,
                milestone_offset_days=t_data.milestone_offset_days
            )
            db.add(task)
            task_map[task.id] = task
            
        await db.flush()
        
        # Populate Schedule Entries
        for s_data in payload.schedule_entries:
            if s_data.employee_id not in employee_map:
                raise ValueError(f"Integrity check failed: Schedule entry points to non-existent employee {s_data.employee_id}.")
                
            schedule = ScheduleEntry(
                id=s_data.id,
                employee_id=s_data.employee_id,
                date=s_data.date,
                status=s_data.status
            )
            db.add(schedule)
            
        await db.commit()
        return {
            "status": "success",
            "employees_restored": len(payload.employees),
            "tasks_restored": len(payload.checklist_tasks),
            "schedules_restored": len(payload.schedule_entries)
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database restore failed: {str(e)}"
        )
