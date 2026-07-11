import datetime

import pytest

from app.core.checklist_templates import default_tasks_for, seed_checklist_tasks, _DEPARTMENT_CAPSTONE
from app.models import Employee


@pytest.mark.parametrize("department", list(_DEPARTMENT_CAPSTONE.keys()) + ["Unknown Department"])
def test_default_tasks_for_returns_valid_milestone_offsets(department):
    tasks = default_tasks_for(department)
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
