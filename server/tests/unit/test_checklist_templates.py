import datetime

import pytest
from sqlalchemy import select

from app.core.checklist_templates import default_tasks_for, seed_checklist_tasks
from app.models import ChecklistTemplate, Employee

_DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Finance", "HR", "Unknown Department"]


@pytest.mark.asyncio
@pytest.mark.parametrize("department", _DEPARTMENTS)
async def test_default_tasks_for_returns_valid_milestone_offsets(db_session, department):
    tasks = await default_tasks_for(db_session, department)
    assert len(tasks) > 0
    for task in tasks:
        assert task["milestone_offset_days"] in (30, 60, 90)


@pytest.mark.asyncio
async def test_seed_checklist_tasks_sets_due_date_from_hire_date(db_session):
    emp = Employee(
        name="Due Date Test User",
        email="due.date.test@meridian.com",
        slack_handle="@due.date.test",
        department="Engineering",
        hire_date=datetime.date(2026, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp)
    await db_session.flush()

    tasks = await seed_checklist_tasks(db_session, emp.id, emp.department)

    assert len(tasks) > 0
    for task in tasks:
        assert task.milestone_offset_days in (30, 60, 90)
        expected_due = emp.hire_date + datetime.timedelta(days=task.milestone_offset_days)
        assert task.due_date == expected_due


@pytest.mark.asyncio
async def test_blocked_by_survives_template_reorder(db_session):
    """Regression test for the hardcoded idx==3 positional hack this
    replaced: reorder the core templates via a direct DB edit (equivalent to
    what an HR admin does through the checklist-templates CRUD routes), then
    confirm a freshly seeded checklist still blocks "Install corporate
    security software" on "Configure work laptop" -- the specific pair the
    old code wired by list position rather than by identity."""
    stmt = select(ChecklistTemplate).where(ChecklistTemplate.department.is_(None))
    core_templates = {t.title: t for t in (await db_session.execute(stmt)).scalars().all()}

    laptop = core_templates["Configure work laptop"]
    security = core_templates["Install corporate security software"]
    assert security.blocked_by_template_id == laptop.id  # sanity-check the fixture seeding

    # Push "Sign employment contract" (originally sort_order 0) to the back,
    # shifting "Install corporate security software" from combined-list
    # index 3 down to index 2.
    core_templates["Sign employment contract"].sort_order = 10
    await db_session.flush()

    emp = Employee(
        name="Reorder Regression User",
        email="reorder.regression@meridian.com",
        slack_handle="@reorder.regression",
        department="Engineering",
        hire_date=datetime.date(2026, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp)
    await db_session.flush()

    tasks = await seed_checklist_tasks(db_session, emp.id, emp.department)
    by_title = {t.title: t for t in tasks}

    laptop_task = by_title["Configure work laptop"]
    security_task = by_title["Install corporate security software"]
    assert security_task.blocked_by == laptop_task.id
