"""add audit log table

Revision ID: b2d3f4a5c6e7
Revises: a1c2e3f4b5d6
Create Date: 2026-07-11 00:00:00.000000

Adds the audit_log table used to record restore-confirmation events (and
any future admin actions) -- actor, action name, and a JSON detail blob
(e.g. restored-row counts for backup_restore).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d3f4a5c6e7'
down_revision: Union[str, None] = 'a1c2e3f4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'audit_log',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('actor_employee_id', sa.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('idx_audit_log_created_at', 'audit_log', ['created_at'])


def downgrade() -> None:
    op.drop_index('idx_audit_log_created_at', table_name='audit_log')
    op.drop_table('audit_log')
