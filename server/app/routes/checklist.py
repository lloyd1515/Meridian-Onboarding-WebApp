from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Employee, ChecklistTask
from app.schemas import ChecklistTaskOut, SkipRequest

router = APIRouter(prefix="/checklists", tags=["Checklist"])

async def recursive_unblock_tasks(tasks: List[ChecklistTask]):
    # Keep checking dependencies recursively
    updated = True
    while updated:
        updated = False
        
        # Build map of task ID -> status for easy checking
        status_map = {str(t.id): t.status for t in tasks}
        
        for t in tasks:
            if t.status == "blocked":
                # Check if all dependencies are completed or skipped
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
async def get_employee_checklist(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # Only allow own checklist fetch, or admin role fetch
    import datetime
    today = datetime.date.today()
    is_admin = current_user.role == "hr_admin" and current_user.hire_date <= today
    
    if current_user.id != employee_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: cannot fetch another user's checklist"
        )
        
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == employee_id).order_by(ChecklistTask.title)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{task_id}/complete", response_model=ChecklistTaskOut)
async def complete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # pessimistic write lock sorted by ID to prevent deadlocks
    # 1. Fetch all tasks of the user with pessimistic lock
    stmt = (
        select(ChecklistTask)
        .where(ChecklistTask.employee_id == current_user.id)
        .order_by(ChecklistTask.id.asc())
        .with_for_update()
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    # 2. Find target task
    target_task = next((t for t in tasks if t.id == task_id), None)
    if not target_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or does not belong to user"
        )
        
    if target_task.status in ["completed", "skipped"]:
        return target_task
        
    # Mark target task as completed
    target_task.status = "completed"
    
    # Recursively unblock children tasks
    await recursive_unblock_tasks(tasks)
    
    await db.commit()
    return target_task

@router.post("/{task_id}/skip", response_model=ChecklistTaskOut)
async def skip_task(
    task_id: UUID,
    payload: SkipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    # pessimistic write lock sorted by ID to prevent deadlocks
    # 1. Fetch all tasks of the user with pessimistic lock
    stmt = (
        select(ChecklistTask)
        .where(ChecklistTask.employee_id == current_user.id)
        .order_by(ChecklistTask.id.asc())
        .with_for_update()
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    # 2. Find target task
    target_task = next((t for t in tasks if t.id == task_id), None)
    if not target_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or does not belong to user"
        )
        
    if target_task.status in ["completed", "skipped"]:
        return target_task
        
    # Mark target task as skipped
    target_task.status = "skipped"
    target_task.skip_reason = payload.skip_reason
    
    # Recursively unblock children tasks
    await recursive_unblock_tasks(tasks)
    
    await db.commit()
    return target_task
