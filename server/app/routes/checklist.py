import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_effective_role, RoleChecker
from app.models import Employee, ChecklistTask
from app.schemas import ChecklistTaskOut, SkipRequest

router = APIRouter(prefix="/checklists", tags=["Checklist"])

@router.get("/all", response_model=List[ChecklistTaskOut])
async def get_all_checklists(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"]))
):
    """Every checklist task for every employee, for the HR onboarding dashboard."""
    stmt = select(ChecklistTask).order_by(ChecklistTask.employee_id, ChecklistTask.title)
    result = await db.execute(stmt)
    return result.scalars().all()

async def recursive_unblock_tasks(tasks: List[ChecklistTask]):
    updated = True
    while updated:
        updated = False
        status_map = {str(t.id): t.status for t in tasks}
        
        for t in tasks:
            if t.status == "blocked":
                deps = t.dependencies or []
                if deps:
                    all_unblocked = True
                    for dep_id in deps:
                        dep_status = status_map.get(str(dep_id))
                        if dep_status not in ["completed", "skipped"]:
                            all_unblocked = False
                            break
                    if all_unblocked:
                        t.status = "pending"
                        t.blocked_by = None
                        status_map[str(t.id)] = "pending"
                        updated = True

@router.get("", response_model=List[ChecklistTaskOut])
async def get_my_checklist(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == current_user.id).order_by(ChecklistTask.title)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{employee_id}", response_model=List[ChecklistTaskOut])
async def get_employee_checklist(employee_id: UUID, db: AsyncSession = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    is_admin = get_effective_role(current_user) == "hr_admin"
    
    if current_user.id != employee_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == employee_id).order_by(ChecklistTask.title)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{task_id}/complete", response_model=ChecklistTaskOut)
async def complete_task(task_id: UUID, db: AsyncSession = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    # Pre-boarding accounts can preview their checklist but not act on it —
    # onboarding tasks only become actionable from the hire date onward.
    # Date-based (not role-based): a stale 'preboardee' role must not keep
    # blocking someone whose start date has passed.
    if current_user.hire_date > datetime.date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Checklist tasks can only be completed from your start date onward"
        )
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == current_user.id).order_by(ChecklistTask.id.asc()).with_for_update()
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    target_task = next((t for t in tasks if t.id == task_id), None)
    if not target_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if target_task.status in ["completed", "skipped"]:
        return target_task
        
    target_task.status = "completed"
    target_task.completed_at = datetime.datetime.utcnow()
    await recursive_unblock_tasks(tasks)
    await db.commit()
    return target_task

@router.post("/{task_id}/skip", response_model=ChecklistTaskOut)
async def skip_task(task_id: UUID, payload: SkipRequest, db: AsyncSession = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    # Same pre-boarding gate as complete_task.
    if current_user.hire_date > datetime.date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Checklist tasks can only be skipped from your start date onward"
        )
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == current_user.id).order_by(ChecklistTask.id.asc()).with_for_update()
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    target_task = next((t for t in tasks if t.id == task_id), None)
    if not target_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if target_task.status in ["completed", "skipped"]:
        return target_task
        
    target_task.status = "skipped"
    target_task.skip_reason = payload.skip_reason
    await recursive_unblock_tasks(tasks)
    await db.commit()
    return target_task
