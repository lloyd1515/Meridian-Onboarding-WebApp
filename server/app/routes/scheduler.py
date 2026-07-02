import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, func
from typing import List, Dict
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Employee, ScheduleEntry
from app.schemas import ScheduleEntryOut, SchedulerSubmit

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])

def get_monday(d: datetime.date) -> datetime.date:
    return d - datetime.timedelta(days=d.weekday())

@router.get("", response_model=List[ScheduleEntryOut])
async def get_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # Fetch all entries in the system to support occupancy calculation and rendering
    # We join with Employee to get names if needed
    stmt = select(ScheduleEntry, Employee.name).join(Employee, ScheduleEntry.employee_id == Employee.id)
    result = await db.execute(stmt)
    
    out = []
    for row in result:
        entry, name = row
        out.append(ScheduleEntryOut(
            id=entry.id,
            employee_id=entry.employee_id,
            date=entry.date,
            status=entry.status,
            employee_name=name
        ))
    return out

@router.post("")
async def submit_schedules(
    payload: SchedulerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # 1. Fetch current employee's schedule rows with pessimistic lock to prevent concurrent bypasses
    # We sort by date/ID to prevent deadlock risk
    stmt = (
        select(ScheduleEntry)
        .where(ScheduleEntry.employee_id == current_user.id)
        .order_by(ScheduleEntry.date.asc())
        .with_for_update()
    )
    result = await db.execute(stmt)
    existing_entries = {e.date: e for e in result.scalars().all()}

    # Group by ISO week (Monday date) to check the 3 office days limit
    # We overlay the new bookings over the existing ones
    new_bookings = {b.date: b.status for b in payload.bookings}
    
    # Combined schedule (existing + new overwrites)
    combined = {}
    # Load all existing
    for d, entry in existing_entries.items():
        combined[d] = entry.status
    # Overwrite/add new
    for d, status_val in new_bookings.items():
        combined[d] = status_val

    # Validate the 3 office days limit per week
    weeks: Dict[datetime.date, int] = {}
    for d, status_val in combined.items():
        if status_val == "office":
            monday = get_monday(d)
            weeks[monday] = weeks.get(monday, 0) + 1

    for monday, office_days in weeks.items():
        if office_days > 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum 3 office days allowed per week (Week starting {monday})"
            )

    # 2. Check office occupancy and limits for each office day submitted
    warnings = []
    for d, status_val in new_bookings.items():
        if status_val == "office":
            # Count other employees scheduled as office on this day
            stmt_count = select(func.count(ScheduleEntry.id)).where(
                and_(
                    ScheduleEntry.date == d,
                    ScheduleEntry.status == "office",
                    ScheduleEntry.employee_id != current_user.id
                )
            )
            count = await db.scalar(stmt_count) or 0
            if count >= 130:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Office capacity limit of 130 reached on {d}"
                )
            elif count >= 124:
                warnings.append(f"Office occupancy on {d} is high ({count + 1} people).")

    # 3. Check buddy co-presence rule warning
    if current_user.buddy_id:
        # Find buddy office days
        stmt_buddy = select(ScheduleEntry.date).where(
            and_(
                ScheduleEntry.employee_id == current_user.buddy_id,
                ScheduleEntry.status == "office"
            )
        )
        buddy_dates = set((await db.execute(stmt_buddy)).scalars().all())
        
        my_office_dates = {d for d, s in new_bookings.items() if s == "office"}
        
        if my_office_dates and not my_office_dates.intersection(buddy_dates):
            warnings.append("Buddy is not scheduled at the office on any of your office days.")

    # 4. Apply changes (Delete existing on these dates, then insert new)
    if payload.bookings:
        dates_to_delete = [b.date for b in payload.bookings]
        await db.execute(
            delete(ScheduleEntry).where(
                and_(
                    ScheduleEntry.employee_id == current_user.id,
                    ScheduleEntry.date.in_(dates_to_delete)
                )
            )
        )
        
        for b in payload.bookings:
            # Only add if status is not empty/none
            if b.status in ["office", "remote"]:
                db.add(ScheduleEntry(
                    employee_id=current_user.id,
                    date=b.date,
                    status=b.status
                ))

    await db.commit()
    return {"status": "success", "warnings": warnings}
