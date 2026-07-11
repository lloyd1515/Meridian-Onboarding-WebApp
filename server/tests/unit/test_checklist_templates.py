import datetime

import pytest

from app.core.checklist_templates import default_tasks_for, seed_checklist_tasks
from app.models import Employee

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
