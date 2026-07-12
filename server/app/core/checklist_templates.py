from datetime import timedelta
from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChecklistTask, ChecklistTemplate, Employee


class TaskTemplate(TypedDict):
    id: UUID
    title: str
    description: str
    status: str
    deps: list[int]
    blocked_by_template_id: Optional[UUID]
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
            "id": row.id,
            "title": row.title,
            "description": row.description,
            "status": row.default_status,
            "deps": row.dependency_indices or [],
            "blocked_by_template_id": row.blocked_by_template_id,
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
        created_tasks.append(task)

    # Single round-trip to populate every task's id, instead of one flush
    # per task -- needed below to resolve dependency indices and the
    # blocked-by template reference into real task ids.
    await db.flush()

    # Template id -> the ChecklistTask just created for it, so blocked_by
    # can be resolved by stable template identity rather than a positional
    # index into this list (which shifts whenever HR reorders/edits
    # templates via the checklist-templates CRUD routes).
    task_by_template_id = {td["id"]: task for td, task in zip(tasks_data, created_tasks)}

    for idx, td in enumerate(tasks_data):
        dep_indices = td["deps"]
        if dep_indices:
            dep_uuids = [str(created_tasks[d_idx].id) for d_idx in dep_indices]
            created_tasks[idx].dependencies = dep_uuids

        blocked_by_template_id = td["blocked_by_template_id"]
        blocker_task = task_by_template_id.get(blocked_by_template_id)
        if blocker_task:
            created_tasks[idx].blocked_by = blocker_task.id

    return created_tasks
