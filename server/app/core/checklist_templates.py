from typing import TypedDict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChecklistTask


class TaskTemplate(TypedDict):
    title: str
    description: str
    status: str
    deps: list[int]


# Shared by every department: contract, laptop setup, buddy intro, security
# training, and meeting the team. Index 3 ("Install corporate security
# software") is blocked_by index 1 ("Configure work laptop") for everyone --
# seed_checklist_tasks() below relies on that fixed position.
_CORE_TASKS: list[TaskTemplate] = [
    {"title": "Sign employment contract", "description": "Complete electronic signing of your contract and annexes in the portal.", "status": "completed", "deps": []},
    {"title": "Configure work laptop", "description": "Install operating system, VPN client, and core development tools.", "status": "in_progress", "deps": []},
    {"title": "First meeting with Buddy", "description": "Schedule a 30-minute Zoom or coffee meet to get to know each other.", "status": "pending", "deps": [1]},
    {"title": "Install corporate security software", "description": "Install the local security agent before accessing the internal network.", "status": "blocked", "deps": [1, 2]},
    {"title": "Information security training", "description": "Complete the mandatory interactive training on the HR platform.", "status": "pending", "deps": [0]},
    {"title": "Meet the team members", "description": "Schedule informal 1-on-1 chats with other teammates in your department.", "status": "pending", "deps": []},
]

# Department-specific 90-day capstone (indices 6-7 of the final list).
_DEPARTMENT_CAPSTONE: dict[str, list[TaskTemplate]] = {
    "Engineering": [
        {"title": "Submit first Pull Request (PR)", "description": "Fix a small bug or implement a minor change in the main codebase.", "status": "pending", "deps": [1]},
        {"title": "Present a mini-demo", "description": "Showcase your completed project during the weekly engineering sync.", "status": "pending", "deps": [6]},
    ],
    "Sales": [
        {"title": "Shadow a client call", "description": "Sit in on a live sales call with your manager or buddy to see the pitch in action.", "status": "pending", "deps": [1]},
        {"title": "Deliver your first prospect pitch", "description": "Present a practice pitch to your manager and get feedback.", "status": "pending", "deps": [6]},
    ],
    "Marketing": [
        {"title": "Draft a sample campaign brief", "description": "Put together a short campaign brief following the team's template.", "status": "pending", "deps": [1]},
        {"title": "Present your brief in the weekly sync", "description": "Walk the marketing team through your sample campaign brief.", "status": "pending", "deps": [6]},
    ],
    "Finance": [
        {"title": "Complete a mock month-end reconciliation", "description": "Work through a practice reconciliation with your buddy using a sample ledger.", "status": "pending", "deps": [1]},
        {"title": "Walk your manager through the reconciliation", "description": "Present your mock reconciliation and talk through your approach.", "status": "pending", "deps": [6]},
    ],
    "HR": [
        {"title": "Shadow an onboarding session", "description": "Sit in on another new hire's onboarding session or checklist review.", "status": "pending", "deps": [1]},
        {"title": "Run a mock onboarding session", "description": "Practice running a short onboarding session and get feedback from the team.", "status": "pending", "deps": [6]},
    ],
}

_DEFAULT_DEPARTMENT = "Engineering"


def default_tasks_for(department: str) -> list[TaskTemplate]:
    capstone = _DEPARTMENT_CAPSTONE.get(department, _DEPARTMENT_CAPSTONE[_DEFAULT_DEPARTMENT])
    return [*_CORE_TASKS, *capstone]


async def seed_checklist_tasks(db: AsyncSession, employee_id: UUID, department: str) -> list[ChecklistTask]:
    """Create the default onboarding checklist for a newly created employee."""
    tasks_data = default_tasks_for(department)

    created_tasks: list[ChecklistTask] = []
    for td in tasks_data:
        task = ChecklistTask(
            employee_id=employee_id,
            title=td["title"],
            description=td["description"],
            status=td["status"],
            dependencies=[],
        )
        db.add(task)
        await db.flush()
        created_tasks.append(task)

    for idx, td in enumerate(tasks_data):
        dep_indices = td["deps"]
        if dep_indices:
            dep_uuids = [str(created_tasks[d_idx].id) for d_idx in dep_indices]
            created_tasks[idx].dependencies = dep_uuids
            if idx == 3:  # "Install corporate security software" blocked by "Configure work laptop"
                created_tasks[idx].blocked_by = created_tasks[1].id

    return created_tasks
