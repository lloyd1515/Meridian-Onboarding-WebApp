import pytest
import datetime
from app.core.security import hash_password
from app.models import Employee, ChecklistTask

@pytest.fixture
async def authenticated_admin(client, db_session):
    hashed = hash_password("password123")
    admin = Employee(
        name="Elena Ionescu",
        email="elena@meridian.com",
        slack_handle="@elena",
        role="hr_admin",
        department="HR",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(admin)
    await db_session.flush()

    login_data = {"email": "elena@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return admin, csrf_token

@pytest.mark.asyncio
async def test_backup_export_and_restore(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    # 1. Export database
    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    
    backup_data = export_resp.json()
    assert backup_data["version"] == "1.0"
    assert len(backup_data["employees"]) >= 1

    # 2. Modify backup data and restore it
    # We will change the name of the admin in the backup list
    backup_data["employees"][0]["name"] = "Elena Modified"
    
    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["employees_restored"] == 1

    # 3. Verify user name was changed in database
    me_resp = await client.get("/employees/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["name"] == "Elena Modified"

@pytest.mark.asyncio
async def test_backup_restore_invalid_data(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    # Post invalid payload
    invalid_data = {
        "version": "2.0", # Unsupported version
        "exported_at": "now",
        "employees": [],
        "checklist_tasks": [],
        "schedule_entries": []
    }
    
    resp = await client.post("/backup/restore", json=invalid_data, headers=headers)
    assert resp.status_code == 400 # Bad request due to version mismatch

@pytest.mark.asyncio
async def test_backup_export_restore_preserves_due_date_fields(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    due_date = datetime.date(2026, 8, 1)
    completed_at = datetime.datetime(2026, 7, 15, 10, 30, 0)
    task = ChecklistTask(
        employee_id=admin.id,
        title="Complete benefits enrollment",
        status="completed",
        due_date=due_date,
        completed_at=completed_at,
        milestone_offset_days=30,
    )
    db_session.add(task)
    await db_session.flush()

    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    backup_data = export_resp.json()

    exported_task = next(t for t in backup_data["checklist_tasks"] if t["id"] == str(task.id))
    assert exported_task["due_date"] == due_date.isoformat()
    assert exported_task["completed_at"] == completed_at.isoformat()
    assert exported_task["milestone_offset_days"] == 30

    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200

    restored = await db_session.get(ChecklistTask, task.id)
    assert restored is not None
    assert restored.due_date == due_date
    assert restored.completed_at == completed_at
    assert restored.milestone_offset_days == 30


@pytest.mark.asyncio
async def test_backup_restore_orders_blocked_by_before_dependent_task(
    client, db_session, authenticated_admin
):
    """checklist_tasks.blocked_by is a real, enforced FK on Postgres (see
    the create_tables migration). If a task's blocked_by target appears
    LATER than the task in the restore payload, a naive payload-order
    insert violates the FK. The restore handler must topologically sort
    the batch instead. (SQLite doesn't enforce this by default, which is
    why the pre-fix bug was invisible here -- conftest now turns on
    PRAGMA foreign_keys=ON so this test actually exercises the constraint.)
    """
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    backup_data = export_resp.json()

    import uuid

    blocker_id = str(uuid.uuid4())
    dependent_id = str(uuid.uuid4())

    # Intentionally reversed: the dependent task (blocked_by=blocker_id)
    # appears BEFORE the task it depends on in the payload array.
    backup_data["checklist_tasks"] = [
        {
            "id": dependent_id,
            "employee_id": str(admin.id),
            "title": "Dependent task",
            "description": None,
            "status": "blocked",
            "skip_reason": None,
            "blocked_by": blocker_id,
            "dependencies": None,
            "due_date": None,
            "completed_at": None,
            "milestone_offset_days": None,
        },
        {
            "id": blocker_id,
            "employee_id": str(admin.id),
            "title": "Blocker task",
            "description": None,
            "status": "pending",
            "skip_reason": None,
            "blocked_by": None,
            "dependencies": None,
            "due_date": None,
            "completed_at": None,
            "milestone_offset_days": None,
        },
    ]

    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["tasks_restored"] == 2

    dependent = await db_session.get(ChecklistTask, uuid.UUID(dependent_id))
    blocker = await db_session.get(ChecklistTask, uuid.UUID(blocker_id))
    assert dependent is not None and blocker is not None
    assert dependent.blocked_by == blocker.id
