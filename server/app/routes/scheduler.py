import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, func
from typing import List, Dict
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_effective_role
from app.models import Employee, ScheduleEntry
from app.schemas import SchedulerSubmit, ScheduleEntryOut

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])

def get_monday(d: datetime.date) -> datetime.date:
    return d - datetime.timedelta(days=d.weekday())

@router.get("", response_model=List[ScheduleEntryOut])
async def get_schedules(db: AsyncSession = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    stmt = (
        select(ScheduleEntry, Employee.name)
        .join(Employee, Employee.id == ScheduleEntry.employee_id)
        .order_by(ScheduleEntry.date.asc())
    )
    result = await db.execute(stmt)
    entries = result.all()
    
    out = []
    for entry, name in entries:
        out.append(ScheduleEntryOut(
            id=entry.id,
            employee_id=entry.employee_id,
            date=entry.date,
            status=entry.status,
            employee_name=name
        ))
    return out

@router.post("")
async def submit_schedules(payload: SchedulerSubmit, db: AsyncSession = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    target_employee_id = current_user.id
    target_user = current_user
    
    if payload.employee_id and payload.employee_id != current_user.id:
        is_admin = get_effective_role(current_user) == "hr_admin"
        if not is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        target_employee_id = payload.employee_id
        stmt_user = select(Employee).where(Employee.id == target_employee_id)
        res_user = await db.execute(stmt_user)
        target_user = res_user.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target employee not found")

    stmt = select(ScheduleEntry).where(ScheduleEntry.employee_id == target_employee_id).order_by(ScheduleEntry.date.asc()).with_for_update()
    result = await db.execute(stmt)
    existing_entries = {e.date: e for e in result.scalars().all()}

    new_bookings = {b.date: b.status for b in payload.bookings}
    combined = {}
    for d, entry in existing_entries.items():
        combined[d] = entry.status
    for d, status_val in new_bookings.items():
        combined[d] = status_val

    weeks: Dict[datetime.date, int] = {}
    for d, status_val in combined.items():
        if status_val == "office":
            monday = get_monday(d)
            weeks[monday] = weeks.get(monday, 0) + 1

    for monday, office_days in weeks.items():
        if office_days > 3:
            raise HTTPException(status_code=400, detail=f"Maximum 3 office days allowed per week (Week starting {monday})")

    warnings = []
    for d, status_val in new_bookings.items():
        if status_val == "office":
            # Pessimistically lock existing office entries on this date to serialize concurrent bookings
            stmt_lock = select(ScheduleEntry.id).where(
                and_(
                    ScheduleEntry.date == d,
                    ScheduleEntry.status == "office"
                )
            ).with_for_update()
            await db.execute(stmt_lock)

            stmt_count = select(func.count(ScheduleEntry.id)).where(
                and_(
                    ScheduleEntry.date == d,
                    ScheduleEntry.status == "office",
                    ScheduleEntry.employee_id != target_employee_id
                )
            )
            count = await db.scalar(stmt_count) or 0
            if count >= 130:
                raise HTTPException(status_code=400, detail=f"Office capacity limit of 130 reached on {d}")
            elif count >= 124:
                warnings.append(f"Office occupancy on {d} is high ({count + 1} people).")

    if target_user.buddy_id:
        stmt_buddy = select(ScheduleEntry.date).where(
            and_(
                ScheduleEntry.employee_id == target_user.buddy_id,
                ScheduleEntry.status == "office"
            )
        )
        buddy_dates = set((await db.execute(stmt_buddy)).scalars().all())
        my_office_dates = {d for d, s in new_bookings.items() if s == "office"}
        if my_office_dates and not my_office_dates.intersection(buddy_dates):
            warnings.append("Buddy is not scheduled at the office on any of your office days.")

    if payload.bookings:
        dates_to_delete = [b.date for b in payload.bookings]
        await db.execute(delete(ScheduleEntry).where(and_(ScheduleEntry.employee_id == target_employee_id, ScheduleEntry.date.in_(dates_to_delete))))
        for b in payload.bookings:
            if b.status in ["office", "remote"]:
                db.add(ScheduleEntry(employee_id=target_employee_id, date=b.date, status=b.status))

    await db.commit()
    return {"status": "success", "warnings": warnings}
