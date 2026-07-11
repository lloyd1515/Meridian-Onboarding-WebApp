from datetime import timedelta
from typing import TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChecklistTask, ChecklistTemplate, Employee


class TaskTemplate(TypedDict):
    title: str
    description: str
    status: str
    deps: list[int]
    milestone_offset_days: int


_DEFAULT_DEPARTMENT = "Engineering"


async def default_tasks_for(db: AsyncSession, department: str) -> list[TaskTemplate]:
    """Build the ordered task-template list for a department: shared core
    tasks (department IS NULL) followed by that department's capstone tasks,
    both read from the HR-editable checklist_templates table and ordered by
    sort_order. Falls back to _DEFAULT_DEPARTMENT's capstone when no
    templates exist for the requested department (mirrors the old
    hardcoded-dict fallback behavior)."""
    core_stmt = (
        select(ChecklistTemplate)
        .where(ChecklistTemplate.department.is_(None))
        .order_by(ChecklistTemplate.sort_order)
    )
    core_rows = (await db.execute(core_stmt)).scalars().all()

    capstone_stmt = (
        select(ChecklistTemplate)
        .where(ChecklistTemplate.department == department)
        .order_by(ChecklistTemplate.sort_order)
    )
    capstone_rows = (await db.execute(capstone_stmt)).scalars().all()

    if not capstone_rows:
        fallback_stmt = (
            select(ChecklistTemplate)
            .where(ChecklistTemplate.department == _DEFAULT_DEPARTMENT)
            .order_by(ChecklistTemplate.sort_order)
        )
        capstone_rows = (await db.execute(fallback_stmt)).scalars().all()

    def _to_task_template(row: ChecklistTemplate) -> TaskTemplate:
        return {
            "title": row.title,
            "description": row.description,
            "status": row.default_status,
            "deps": row.dependency_indices or [],
            "milestone_offset_days": row.milestone_offset_days,
        }

    return [_to_task_template(r) for r in (*core_rows, *capstone_rows)]


async def seed_checklist_tasks(db: AsyncSession, employee_id: UUID, department: str) -> list[ChecklistTask]:
    """Create the default onboarding checklist for a newly created employee."""
    tasks_data = await default_tasks_for(db, department)

    # Every caller (signup, HR's "Add New Hire", the seed script) has already
    # added/flushed the employee row in this same session, so this resolves
    # from the session's identity map rather than issuing a fresh query.
    employee = await db.get(Employee, employee_id)
    hire_date = employee.hire_date if employee else None

    created_tasks: list[ChecklistTask] = []
    for td in tasks_data:
        offset = td["milestone_offset_days"]
        due_date = hire_date + timedelta(days=offset) if hire_date else None
        task = ChecklistTask(
            employee_id=employee_id,
            title=td["title"],
            description=td["description"],
            status=td["status"],
            dependencies=[],
            milestone_offset_days=offset,
            due_date=due_date,
        )
        db.add(task)
        await db.flush()
        created_tasks.append(task)

    for idx, td in enumerate(tasks_data):
        dep_indices = td["deps"]
        if dep_indices:
            dep_uuids = [str(created_tasks[d_idx].id) for d_idx in dep_indices]
            created_tasks[idx].dependencies = dep_uuids
            if idx == 3:  # "Install corporate security software" blocked by "Configure work laptop"
                created_tasks[idx].blocked_by = created_tasks[1].id

    return created_tasks
