import datetime

import pytest

from app.core.email_digest import build_digest, render_digest_text
from app.models import ChecklistTask, Employee, Question


def _make_employee(email: str, name: str = "Test Employee") -> Employee:
    return Employee(
        name=name,
        email=email,
        slack_handle="@" + email.split("@")[0],
        department="Engineering",
        hire_date=datetime.date(2026, 1, 1),
        hashed_password="password",
    )


@pytest.mark.asyncio
async def test_build_digest_empty_when_nothing_open_or_overdue(db_session):
    emp = _make_employee("empty.digest@meridian.com")
    db_session.add(emp)
    await db_session.flush()
    await db_session.commit()

    digest = await build_digest(db_session)

    assert digest.open_questions == []
    assert digest.overdue_tasks == []


@pytest.mark.asyncio
async def test_build_digest_includes_open_question_with_age(db_session):
    emp = _make_employee("asker@meridian.com", name="Asker Employee")
    db_session.add(emp)
    await db_session.flush()

    now = datetime.datetime(2026, 7, 12, 9, 0, 0)
    created = now - datetime.timedelta(days=3)
    db_session.add(Question(
        employee_id=emp.id,
        subject="How do I set up VPN?",
        body="Need help configuring the VPN client.",
        status="open",
        created_at=created,
    ))
    # An answered question should NOT show up in the digest.
    db_session.add(Question(
        employee_id=emp.id,
        subject="Already answered",
        body="This one is resolved.",
        status="answered",
        created_at=created,
        answer="Here you go.",
        answered_at=now,
    ))
    await db_session.commit()

    digest = await build_digest(db_session, as_of=now)

    assert len(digest.open_questions) == 1
    item = digest.open_questions[0]
    assert item.subject == "How do I set up VPN?"
    assert item.employee_name == "Asker Employee"
    assert item.age_days == 3


@pytest.mark.asyncio
async def test_build_digest_overdue_task_boundary(db_session):
    """due today should NOT count as overdue; due yesterday should."""
    emp = _make_employee("overdue@meridian.com", name="Overdue Employee")
    db_session.add(emp)
    await db_session.flush()

    now = datetime.datetime(2026, 7, 12, 9, 0, 0)
    today = now.date()
    yesterday = today - datetime.timedelta(days=1)

    due_today = ChecklistTask(
        employee_id=emp.id,
        title="Due today task",
        status="pending",
        due_date=today,
    )
    due_yesterday = ChecklistTask(
        employee_id=emp.id,
        title="Overdue task",
        status="pending",
        due_date=yesterday,
    )
    db_session.add_all([due_today, due_yesterday])
    await db_session.commit()

    digest = await build_digest(db_session, as_of=now)

    assert len(digest.overdue_tasks) == 1
    item = digest.overdue_tasks[0]
    assert item.title == "Overdue task"
    assert item.employee_name == "Overdue Employee"
    assert item.days_overdue == 1


@pytest.mark.asyncio
async def test_build_digest_excludes_completed_and_skipped_tasks(db_session):
    emp = _make_employee("done.tasks@meridian.com")
    db_session.add(emp)
    await db_session.flush()

    now = datetime.datetime(2026, 7, 12, 9, 0, 0)
    yesterday = now.date() - datetime.timedelta(days=1)

    completed = ChecklistTask(
        employee_id=emp.id,
        title="Completed but past due_date",
        status="completed",
        due_date=yesterday,
        completed_at=now,
    )
    skipped = ChecklistTask(
        employee_id=emp.id,
        title="Skipped but past due_date",
        status="skipped",
        due_date=yesterday,
    )
    still_open_no_due_date = ChecklistTask(
        employee_id=emp.id,
        title="No due date set",
        status="pending",
    )
    db_session.add_all([completed, skipped, still_open_no_due_date])
    await db_session.commit()

    digest = await build_digest(db_session, as_of=now)

    assert digest.overdue_tasks == []


@pytest.mark.asyncio
async def test_build_digest_multiple_questions_and_tasks(db_session):
    emp1 = _make_employee("multi.one@meridian.com", name="Employee One")
    emp2 = _make_employee("multi.two@meridian.com", name="Employee Two")
    db_session.add_all([emp1, emp2])
    await db_session.flush()

    now = datetime.datetime(2026, 7, 12, 9, 0, 0)
    yesterday = now.date() - datetime.timedelta(days=1)
    two_days_ago = now.date() - datetime.timedelta(days=2)

    db_session.add(Question(
        employee_id=emp1.id, subject="Q1", body="b1", status="open", created_at=now,
    ))
    db_session.add(Question(
        employee_id=emp2.id, subject="Q2", body="b2", status="open", created_at=now,
    ))
    db_session.add(ChecklistTask(
        employee_id=emp1.id, title="Task A", status="pending", due_date=yesterday,
    ))
    db_session.add(ChecklistTask(
        employee_id=emp2.id, title="Task B", status="in_progress", due_date=two_days_ago,
    ))
    await db_session.commit()

    digest = await build_digest(db_session, as_of=now)

    assert len(digest.open_questions) == 2
    assert len(digest.overdue_tasks) == 2
    # Ordered by due_date ascending -> the older overdue task comes first.
    assert digest.overdue_tasks[0].title == "Task B"
    assert digest.overdue_tasks[0].days_overdue == 2
    assert digest.overdue_tasks[1].title == "Task A"
    assert digest.overdue_tasks[1].days_overdue == 1


def test_render_digest_text_empty_sections():
    from app.core.email_digest import Digest

    text = render_digest_text(Digest())

    assert "Open questions (0)" in text
    assert "Overdue tasks (0)" in text
    assert "(none)" in text


def test_render_digest_text_with_items():
    from app.core.email_digest import Digest, OpenQuestionItem, OverdueTaskItem

    digest = Digest(
        open_questions=[OpenQuestionItem(subject="Q", employee_name="Jane", age_days=5)],
        overdue_tasks=[OverdueTaskItem(title="T", employee_name="Bob", days_overdue=2)],
    )

    text = render_digest_text(digest)

    assert "[Jane] Q (open 5d)" in text
    assert "[Bob] T (2d overdue)" in text
