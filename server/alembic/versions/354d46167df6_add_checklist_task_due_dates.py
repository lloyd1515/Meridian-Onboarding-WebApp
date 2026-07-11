"""add checklist task due dates

Revision ID: 354d46167df6
Revises: 959b067758e1
Create Date: 2026-07-11 00:00:00.000000

Backfill note: `completed_at` cannot be recovered for rows that were already
"completed" before this migration -- there is no historical timestamp to draw
from. As a best-effort placeholder, existing completed rows get
`completed_at` set to the migration's run time (i.e. "we know it was done by
now, not exactly when"). New completions going forward get real timestamps
from app/routes/checklist.py.

Backfill note: `due_date` for existing rows is derived by porting the
frontend's old THIRTY_DAY_TASK_TITLES / SIXTY_DAY_TASK_TITLES title-matching
(src/services/db.ts) into a one-off Python lookup here. Titles not in either
set (department capstone tasks) default to a 90-day offset. This mirrors
exactly what the app already inferred before this migration, so existing
rows keep the same apparent milestone bucket they had.
"""
from typing import Sequence, Union
import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, select


# revision identifiers, used by Alembic.
revision: str = '354d46167df6'
down_revision: Union[str, None] = '959b067758e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Ported from src/services/db.ts THIRTY_DAY_TASK_TITLES / SIXTY_DAY_TASK_TITLES.
# Keep in sync with server/app/core/checklist_templates.py's milestone_offset_days.
_THIRTY_DAY_TASK_TITLES = {
    "Sign employment contract",
    "Configure work laptop",
    "First meeting with Buddy",
}
_SIXTY_DAY_TASK_TITLES = {
    "Install corporate security software",
    "Information security training",
    "Meet the team members",
}


def _offset_for_title(title: str) -> int:
    if title in _THIRTY_DAY_TASK_TITLES:
        return 30
    if title in _SIXTY_DAY_TASK_TITLES:
        return 60
    return 90


def upgrade() -> None:
    op.add_column('checklist_tasks', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('checklist_tasks', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('checklist_tasks', sa.Column('milestone_offset_days', sa.Integer(), nullable=True))

    connection = op.get_bind()

    checklist_tasks = table(
        'checklist_tasks',
        column('id', sa.UUID()),
        column('employee_id', sa.UUID()),
        column('title', sa.String()),
        column('status', sa.String()),
        column('due_date', sa.Date()),
        column('completed_at', sa.DateTime()),
        column('milestone_offset_days', sa.Integer()),
    )
    employees = table(
        'employees',
        column('id', sa.UUID()),
        column('hire_date', sa.Date()),
    )

    rows = connection.execute(
        select(
            checklist_tasks.c.id,
            checklist_tasks.c.title,
            checklist_tasks.c.status,
            employees.c.hire_date,
        ).select_from(checklist_tasks.join(employees, checklist_tasks.c.employee_id == employees.c.id))
    ).fetchall()

    now = datetime.datetime.utcnow()
    for row in rows:
        offset = _offset_for_title(row.title)
        due_date = row.hire_date + datetime.timedelta(days=offset) if row.hire_date else None
        values = {'milestone_offset_days': offset, 'due_date': due_date}
        if row.status == "completed":
            values['completed_at'] = now
        connection.execute(
            checklist_tasks.update().where(checklist_tasks.c.id == row.id).values(**values)
        )


def downgrade() -> None:
    op.drop_column('checklist_tasks', 'milestone_offset_days')
    op.drop_column('checklist_tasks', 'completed_at')
    op.drop_column('checklist_tasks', 'due_date')
