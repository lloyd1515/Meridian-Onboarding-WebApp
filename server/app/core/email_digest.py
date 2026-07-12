"""HR email digest: open questions + overdue checklist tasks.

Pure content-building functions, kept DB-session-agnostic where possible so
they're easy to unit-test without SMTP or a running app (see
server/tests/unit/test_email_digest.py). server/scripts/send_digest.py wires
this up to a real DB session and an actual SMTP send.
"""
import datetime
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ChecklistTask, Question

DIGEST_SUBJECT = "Meridian Onboarding — HR Daily Digest"

# Tasks in these terminal states are no longer "in flight" even if their
# due_date has slipped into the past, so they shouldn't show up as overdue
# (mirrors the completion/skip flow in routes/checklist.py, which sets
# status to one of these when a task is done being tracked).
_TERMINAL_TASK_STATUSES = ("completed", "skipped")


@dataclass
class OpenQuestionItem:
    subject: str
    employee_name: str
    age_days: int


@dataclass
class OverdueTaskItem:
    title: str
    employee_name: str
    days_overdue: int


@dataclass
class Digest:
    open_questions: List[OpenQuestionItem] = field(default_factory=list)
    overdue_tasks: List[OverdueTaskItem] = field(default_factory=list)


async def build_digest(db: AsyncSession, as_of: Optional[datetime.datetime] = None) -> Digest:
    """Query open HR questions and overdue checklist tasks and return a
    structured digest. `as_of` lets tests pin "now" instead of relying on the
    real clock; defaults to datetime.utcnow()."""
    now = as_of or datetime.datetime.utcnow()
    today = now.date()

    questions_stmt = (
        select(Question)
        .options(selectinload(Question.employee))
        .where(Question.status == "open")
        .order_by(Question.created_at)
    )
    questions = (await db.execute(questions_stmt)).scalars().all()
    open_questions = [
        OpenQuestionItem(
            subject=q.subject,
            employee_name=q.employee.name if q.employee else "Unknown",
            age_days=(now - q.created_at).days,
        )
        for q in questions
    ]

    # due_date < today (strictly in the past) excludes tasks due today --
    # those aren't overdue yet.
    tasks_stmt = (
        select(ChecklistTask)
        .options(selectinload(ChecklistTask.employee))
        .where(
            ChecklistTask.due_date.is_not(None),
            ChecklistTask.due_date < today,
            ChecklistTask.completed_at.is_(None),
            ChecklistTask.status.notin_(_TERMINAL_TASK_STATUSES),
        )
        .order_by(ChecklistTask.due_date)
    )
    tasks = (await db.execute(tasks_stmt)).scalars().all()
    overdue_tasks = [
        OverdueTaskItem(
            title=t.title,
            employee_name=t.employee.name if t.employee else "Unknown",
            days_overdue=(today - t.due_date).days,
        )
        for t in tasks
    ]

    return Digest(open_questions=open_questions, overdue_tasks=overdue_tasks)


def render_digest_text(digest: Digest) -> str:
    """Render a Digest into a plain-text email body."""
    lines = [DIGEST_SUBJECT, ""]

    lines.append(f"Open questions ({len(digest.open_questions)}):")
    if digest.open_questions:
        for q in digest.open_questions:
            lines.append(f"  - [{q.employee_name}] {q.subject} (open {q.age_days}d)")
    else:
        lines.append("  (none)")

    lines.append("")
    lines.append(f"Overdue tasks ({len(digest.overdue_tasks)}):")
    if digest.overdue_tasks:
        for t in digest.overdue_tasks:
            lines.append(f"  - [{t.employee_name}] {t.title} ({t.days_overdue}d overdue)")
    else:
        lines.append("  (none)")

    lines.append("")
    return "\n".join(lines)
