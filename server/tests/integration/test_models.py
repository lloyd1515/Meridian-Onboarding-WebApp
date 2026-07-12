import pytest
import datetime
from sqlalchemy import select, Date, DateTime, Integer
from sqlalchemy.exc import IntegrityError
from app.models import Employee, ChecklistTask, ScheduleEntry

@pytest.mark.asyncio
async def test_employee_creation_and_relations(db_session):
    # 1. Create a Buddy Employee
    buddy = Employee(
        name="Alex Buddy",
        email="alex.buddy@meridian.com",
        slack_handle="@alex.buddy",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2023, 6, 10),
        hashed_password="securepassword",
    )
    db_session.add(buddy)
    await db_session.flush()

    # 2. Create a New Hire Employee pointing to the Buddy
    new_hire = Employee(
        name="Jane Newhire",
        email="jane.newhire@meridian.com",
        slack_handle="@jane.newhire",
        role="preboardee",
        department="Engineering",
        hire_date=datetime.date(2026, 7, 1),
        buddy_id=buddy.id,
        hashed_password="anotherpassword",
    )
    db_session.add(new_hire)
    await db_session.flush()

    # Verify query retrieves new hire and buddy relationship correctly
    stmt = select(Employee).where(Employee.id == new_hire.id)
    result = await db_session.execute(stmt)
    retrieved_hire = result.scalar_one()

    assert retrieved_hire.name == "Jane Newhire"
    assert retrieved_hire.buddy.name == "Alex Buddy"
    assert retrieved_hire.role == "preboardee"

@pytest.mark.asyncio
async def test_employee_unique_email(db_session):
    emp1 = Employee(
        name="John Doe",
        email="john@meridian.com",
        slack_handle="@john",
        department="HR",
        hire_date=datetime.date(2024, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp1)
    await db_session.flush()

    emp2 = Employee(
        name="Jane Smith",
        email="john@meridian.com", # Duplicate email
        slack_handle="@jane",
        department="Sales",
        hire_date=datetime.date(2024, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp2)

    with pytest.raises(IntegrityError):
        await db_session.flush()

@pytest.mark.asyncio
async def test_checklist_task_cascade_delete(db_session):
    emp = Employee(
        name="Checklist Test User",
        email="test.checklist@meridian.com",
        slack_handle="@test.checklist",
        department="Finance",
        hire_date=datetime.date(2024, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp)
    await db_session.flush()

    task = ChecklistTask(
        employee_id=emp.id,
        title="Checklist Task 1",
        description="Verify this task is deleted when employee is deleted",
        status="pending",
    )
    db_session.add(task)
    await db_session.flush()

    # Verify task is created
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == emp.id)
    assert (await db_session.execute(stmt)).scalars().all() != []

    # Delete employee
    await db_session.delete(emp)
    await db_session.flush()

    # Verify task is cascade deleted
    stmt = select(ChecklistTask).where(ChecklistTask.employee_id == emp.id)
    assert (await db_session.execute(stmt)).scalars().all() == []

def test_checklist_task_has_due_date_columns():
    columns = ChecklistTask.__table__.columns
    assert isinstance(columns["due_date"].type, Date)
    assert columns["due_date"].nullable is True
    assert isinstance(columns["completed_at"].type, DateTime)
    assert columns["completed_at"].nullable is True
    assert isinstance(columns["milestone_offset_days"].type, Integer)
    assert columns["milestone_offset_days"].nullable is True


@pytest.mark.asyncio
async def test_checklist_task_due_date_fields_persist(db_session):
    emp = Employee(
        name="Due Date Column User",
        email="due.date.column@meridian.com",
        slack_handle="@due.date.column",
        department="Engineering",
        hire_date=datetime.date(2026, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp)
    await db_session.flush()

    task = ChecklistTask(
        employee_id=emp.id,
        title="Task with due date",
        status="completed",
        due_date=datetime.date(2026, 1, 31),
        completed_at=datetime.datetime(2026, 1, 20, 12, 0, 0),
        milestone_offset_days=30,
    )
    db_session.add(task)
    await db_session.flush()

    stmt = select(ChecklistTask).where(ChecklistTask.id == task.id)
    retrieved = (await db_session.execute(stmt)).scalar_one()
    assert retrieved.due_date == datetime.date(2026, 1, 31)
    assert retrieved.completed_at == datetime.datetime(2026, 1, 20, 12, 0, 0)
    assert retrieved.milestone_offset_days == 30


@pytest.mark.asyncio
async def test_schedule_unique_employee_date(db_session):
    emp = Employee(
        name="Schedule Test User",
        email="test.schedule@meridian.com",
        slack_handle="@test.schedule",
        department="Marketing",
        hire_date=datetime.date(2024, 1, 1),
        hashed_password="password",
    )
    db_session.add(emp)
    await db_session.flush()

    entry1 = ScheduleEntry(
        employee_id=emp.id,
        date=datetime.date(2026, 7, 6),
        status="office",
    )
    db_session.add(entry1)
    await db_session.flush()

    # Second entry on the same date for the same employee
    entry2 = ScheduleEntry(
        employee_id=emp.id,
        date=datetime.date(2026, 7, 6),
        status="remote",
    )
    db_session.add(entry2)

    with pytest.raises(IntegrityError):
        await db_session.flush()
