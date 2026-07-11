"""add checklist templates table

Revision ID: a1c2e3f4b5d6
Revises: 354d46167df6
Create Date: 2026-07-11 00:00:00.000000

Data migration note: seeds the checklist_templates table from the current
hardcoded _CORE_TASKS / _DEPARTMENT_CAPSTONE constants in
app/core/checklist_templates.py, copied inline here so this migration is
self-contained and reproducible. Behavior is byte-for-byte unchanged
immediately after migrating -- app/core/checklist_templates.py switches to
querying this table instead of reading those constants.
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, None] = '354d46167df6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Ported verbatim from app/core/checklist_templates.py's _CORE_TASKS. Shared
# by every department (department=NULL). "deps" are indices into the final
# per-department task list assembled at seed time (core tasks first, then
# that department's capstone pair).
_CORE_TASKS = [
    {"title": "Sign employment contract", "description": "Complete electronic signing of your contract and annexes in the portal.", "status": "completed", "deps": [], "milestone_offset_days": 30},
    {"title": "Configure work laptop", "description": "Install operating system, VPN client, and core development tools.", "status": "in_progress", "deps": [], "milestone_offset_days": 30},
    {"title": "First meeting with Buddy", "description": "Schedule a 30-minute Zoom or coffee meet to get to know each other.", "status": "pending", "deps": [1], "milestone_offset_days": 30},
    {"title": "Install corporate security software", "description": "Install the local security agent before accessing the internal network.", "status": "blocked", "deps": [1, 2], "milestone_offset_days": 60},
    {"title": "Information security training", "description": "Complete the mandatory interactive training on the HR platform.", "status": "pending", "deps": [0], "milestone_offset_days": 60},
    {"title": "Meet the team members", "description": "Schedule informal 1-on-1 chats with other teammates in your department.", "status": "pending", "deps": [], "milestone_offset_days": 60},
]

# Ported verbatim from _DEPARTMENT_CAPSTONE. Department-specific 90-day
# capstone pair (indices 6-7 of the final per-department list).
_DEPARTMENT_CAPSTONE = {
    "Engineering": [
        {"title": "Submit first Pull Request (PR)", "description": "Fix a small bug or implement a minor change in the main codebase.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Present a mini-demo", "description": "Showcase your completed project during the weekly engineering sync.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Sales": [
        {"title": "Shadow a client call", "description": "Sit in on a live sales call with your manager or buddy to see the pitch in action.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Deliver your first prospect pitch", "description": "Present a practice pitch to your manager and get feedback.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Marketing": [
        {"title": "Draft a sample campaign brief", "description": "Put together a short campaign brief following the team's template.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Present your brief in the weekly sync", "description": "Walk the marketing team through your sample campaign brief.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Finance": [
        {"title": "Complete a mock month-end reconciliation", "description": "Work through a practice reconciliation with your buddy using a sample ledger.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Walk your manager through the reconciliation", "description": "Present your mock reconciliation and talk through your approach.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "HR": [
        {"title": "Shadow an onboarding session", "description": "Sit in on another new hire's onboarding session or checklist review.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Run a mock onboarding session", "description": "Practice running a short onboarding session and get feedback from the team.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
}


def upgrade() -> None:
    op.create_table(
        'checklist_templates',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('default_status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('milestone_offset_days', sa.Integer(), nullable=False),
        sa.Column('dependency_indices', sa.JSON(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_checklist_templates_department', 'checklist_templates', ['department'])

    checklist_templates = table(
        'checklist_templates',
        column('id', sa.UUID(as_uuid=True)),
        column('department', sa.String()),
        column('title', sa.String()),
        column('description', sa.String()),
        column('default_status', sa.String()),
        column('milestone_offset_days', sa.Integer()),
        column('dependency_indices', sa.JSON()),
        column('sort_order', sa.Integer()),
    )

    rows = []
    for idx, t in enumerate(_CORE_TASKS):
        rows.append({
            "id": uuid.uuid4(),
            "department": None,
            "title": t["title"],
            "description": t["description"],
            "default_status": t["status"],
            "milestone_offset_days": t["milestone_offset_days"],
            "dependency_indices": t["deps"],
            "sort_order": idx,
        })

    for department, capstone_tasks in _DEPARTMENT_CAPSTONE.items():
        for offset, t in enumerate(capstone_tasks):
            rows.append({
                "id": uuid.uuid4(),
                "department": department,
                "title": t["title"],
                "description": t["description"],
                "default_status": t["status"],
                "milestone_offset_days": t["milestone_offset_days"],
                "dependency_indices": t["deps"],
                "sort_order": len(_CORE_TASKS) + offset,
            })

    op.bulk_insert(checklist_templates, rows)


def downgrade() -> None:
    op.drop_index('idx_checklist_templates_department', table_name='checklist_templates')
    op.drop_table('checklist_templates')
