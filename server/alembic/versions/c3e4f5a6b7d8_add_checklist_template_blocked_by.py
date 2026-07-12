"""add checklist_templates.blocked_by_template_id

Revision ID: c3e4f5a6b7d8
Revises: b2d3f4a5c6e7
Create Date: 2026-07-12 00:00:00.000000

Adds a nullable, self-referential FK on checklist_templates so the
"blocked by" relationship between templates is explicit and persisted --
mirroring dependency_indices in spirit, but as a direct reference instead
of a positional index into the assembled per-department list, so it
survives HR reordering/editing templates via the checklist-templates CRUD
routes.

Data migration: backfills the one relationship that used to be wired via a
hardcoded positional index in app/core/checklist_templates.py's
seed_checklist_tasks (idx == 3 in the combined core+capstone list) --
"Install corporate security software" is blocked by "Configure work
laptop". Both are core tasks (department IS NULL), so they're looked up
by title rather than by the now-removed index.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column, select


# revision identifiers, used by Alembic.
revision: str = 'c3e4f5a6b7d8'
down_revision: Union[str, None] = 'b2d3f4a5c6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_LAPTOP_TITLE = "Configure work laptop"
_SECURITY_SOFTWARE_TITLE = "Install corporate security software"


def upgrade() -> None:
    op.add_column(
        'checklist_templates',
        sa.Column('blocked_by_template_id', sa.UUID(as_uuid=True), sa.ForeignKey('checklist_templates.id', ondelete='SET NULL'), nullable=True),
    )

    checklist_templates = table(
        'checklist_templates',
        column('id', sa.UUID(as_uuid=True)),
        column('department', sa.String()),
        column('title', sa.String()),
        column('blocked_by_template_id', sa.UUID(as_uuid=True)),
    )

    bind = op.get_bind()
    laptop_id = bind.execute(
        select(checklist_templates.c.id).where(
            checklist_templates.c.department.is_(None),
            checklist_templates.c.title == _LAPTOP_TITLE,
        )
    ).scalar_one_or_none()

    if laptop_id is not None:
        op.execute(
            checklist_templates.update()
            .where(
                checklist_templates.c.department.is_(None),
                checklist_templates.c.title == _SECURITY_SOFTWARE_TITLE,
            )
            .values(blocked_by_template_id=laptop_id)
        )


def downgrade() -> None:
    op.drop_column('checklist_templates', 'blocked_by_template_id')
