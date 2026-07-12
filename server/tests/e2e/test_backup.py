import pytest
import datetime
from app.core.security import hash_password
from app.models import Employee, ChecklistTask, AuditLog
from sqlalchemy import select

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
    backup_data["confirmation_phrase"] = "RESTORE"

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
        "schedule_entries": [],
        "confirmation_phrase": "RESTORE",
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

    backup_data["confirmation_phrase"] = "RESTORE"
    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200

    restored = await db_session.get(ChecklistTask, task.id)
    assert restored is not None
    assert restored.due_date == due_date
    assert restored.completed_at == completed_at
    assert restored.milestone_offset_days == 30


@pytest.mark.asyncio
async def test_backup_restore_preserves_existing_password_hash(
    client, db_session, authenticated_admin
):
    """Regression test for the frontend v2.1 export/restore path
    (src/services/db.ts generateBackupExport -> validateAndRestoreBackup).
    That function builds its own restore payload straight from the exported
    JSON rather than replaying /backup/export's raw response, so this test
    shapes the payload exactly the way validateAndRestoreBackup does (a
    top-level version/exported_at/employees/checklist_tasks/schedule_entries
    object, with employees carrying their real hashed_password) to prove the
    real login hash -- not the restore handler's default placeholder --
    survives a round trip for an employee who already had a password.
    """
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    backup_data = export_resp.json()

    original_hash = backup_data["employees"][0]["hashed_password"]
    assert original_hash and "placeholder" not in original_hash

    backup_data["confirmation_phrase"] = "RESTORE"
    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200

    restored_admin = await db_session.get(Employee, admin.id)
    assert restored_admin is not None
    assert restored_admin.hashed_password == original_hash


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

    backup_data["confirmation_phrase"] = "RESTORE"
    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["tasks_restored"] == 2

    dependent = await db_session.get(ChecklistTask, uuid.UUID(dependent_id))
    blocker = await db_session.get(ChecklistTask, uuid.UUID(blocker_id))
    assert dependent is not None and blocker is not None
    assert dependent.blocked_by == blocker.id


@pytest.mark.asyncio
async def test_backup_restore_orders_buddy_before_dependent_employee(
    client, db_session, authenticated_admin
):
    """employees.buddy_id is a real, enforced FK (employees_buddy_id_fkey) on
    Postgres. /backup/export has no ORDER BY, so an employee whose buddy_id
    points at a colleague listed LATER in the export array will trip the FK
    on a naive payload-order insert. Mirrors
    test_backup_restore_orders_blocked_by_before_dependent_task for
    checklist_tasks -- the restore handler must topologically sort
    employees by buddy_id the same way it already sorts tasks by
    blocked_by."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    backup_data = export_resp.json()

    import uuid

    buddy_id = str(uuid.uuid4())
    hire_id = str(uuid.uuid4())

    # Intentionally reversed: the new hire (buddy_id=buddy_id) is listed
    # BEFORE the buddy they reference in the payload array.
    backup_data["employees"] = [
        {
            "id": hire_id,
            "name": "New Hire",
            "email": "new.hire.buddy-order@meridian.com",
            "slack_handle": "@new.hire.buddy-order",
            "role": "employee",
            "department": "Engineering",
            "hire_date": "2026-01-01",
            "buddy_id": buddy_id,
            "hybrid_preference": "HYBRID",
            "assigned_desk": None,
            "hashed_password": "irrelevant-placeholder",
        },
        {
            "id": buddy_id,
            "name": "Buddy Employee",
            "email": "buddy.buddy-order@meridian.com",
            "slack_handle": "@buddy.buddy-order",
            "role": "employee",
            "department": "Engineering",
            "hire_date": "2020-01-01",
            "buddy_id": None,
            "hybrid_preference": "HYBRID",
            "assigned_desk": None,
            "hashed_password": "irrelevant-placeholder",
        },
    ]
    backup_data["checklist_tasks"] = []
    backup_data["schedule_entries"] = []
    backup_data["confirmation_phrase"] = "RESTORE"

    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["employees_restored"] == 2

    import uuid as uuid_mod
    hire = await db_session.get(Employee, uuid_mod.UUID(hire_id))
    buddy = await db_session.get(Employee, uuid_mod.UUID(buddy_id))
    assert hire is not None and buddy is not None
    assert hire.buddy_id == buddy.id


@pytest.mark.asyncio
async def test_backup_restore_rejects_mutual_buddy_cycle(
    client, db_session, authenticated_admin
):
    """A genuine cycle (two employees who are each other's buddy) can't be
    inserted in dependency order at all via the self-referential FK -- there
    is no valid ordering. The restore handler must reject it with a clean
    400, not a raw Postgres FK/constraint error."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    assert export_resp.status_code == 200
    backup_data = export_resp.json()

    import uuid

    emp_a_id = str(uuid.uuid4())
    emp_b_id = str(uuid.uuid4())

    backup_data["employees"] = [
        {
            "id": emp_a_id,
            "name": "Employee A",
            "email": "employee.a.cycle@meridian.com",
            "slack_handle": "@employee.a.cycle",
            "role": "employee",
            "department": "Engineering",
            "hire_date": "2022-01-01",
            "buddy_id": emp_b_id,
            "hybrid_preference": "HYBRID",
            "assigned_desk": None,
            "hashed_password": "irrelevant-placeholder",
        },
        {
            "id": emp_b_id,
            "name": "Employee B",
            "email": "employee.b.cycle@meridian.com",
            "slack_handle": "@employee.b.cycle",
            "role": "employee",
            "department": "Engineering",
            "hire_date": "2022-01-01",
            "buddy_id": emp_a_id,
            "hybrid_preference": "HYBRID",
            "assigned_desk": None,
            "hashed_password": "irrelevant-placeholder",
        },
    ]
    backup_data["checklist_tasks"] = []
    backup_data["schedule_entries"] = []
    backup_data["confirmation_phrase"] = "RESTORE"

    before_count = await _existing_audit_log_count(db_session)
    restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert restore_resp.status_code == 400
    assert "cycle" in restore_resp.json()["detail"].lower()
    assert await _existing_audit_log_count(db_session) == before_count


async def _existing_audit_log_count(db_session) -> int:
    result = await db_session.execute(select(AuditLog))
    return len(result.scalars().all())


@pytest.mark.asyncio
async def test_backup_restore_rejects_missing_confirmation_phrase(
    client, db_session, authenticated_admin
):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    backup_data = export_resp.json()
    # No confirmation_phrase at all -- pydantic rejects the payload outright.
    before_count = await _existing_audit_log_count(db_session)

    resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert resp.status_code == 422

    me_resp = await client.get("/employees/me")
    assert me_resp.json()["name"] == admin.name
    assert await _existing_audit_log_count(db_session) == before_count


@pytest.mark.asyncio
async def test_backup_restore_rejects_wrong_confirmation_phrase(
    client, db_session, authenticated_admin
):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    backup_data = export_resp.json()
    backup_data["employees"][0]["name"] = "Should Not Persist"
    backup_data["confirmation_phrase"] = "delete everything"
    before_count = await _existing_audit_log_count(db_session)

    resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert resp.status_code == 400

    # No destructive work should have happened: the admin's name is unchanged
    # and no audit log entry was written for this rejected attempt.
    me_resp = await client.get("/employees/me")
    assert me_resp.json()["name"] == admin.name
    assert await _existing_audit_log_count(db_session) == before_count


@pytest.mark.asyncio
async def test_backup_restore_with_correct_phrase_creates_audit_log_entry(
    client, db_session, authenticated_admin
):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    backup_data = export_resp.json()
    backup_data["confirmation_phrase"] = "RESTORE"

    resp = await client.post("/backup/restore", json=backup_data, headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    result = await db_session.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc())
    )
    entries = result.scalars().all()
    assert len(entries) == 1
    entry = entries[0]
    assert entry.action == "backup_restore"
    assert entry.actor_employee_id == admin.id
    assert entry.detail == {
        "employees_restored": body["employees_restored"],
        "tasks_restored": body["tasks_restored"],
        "schedules_restored": body["schedules_restored"],
    }


@pytest.mark.asyncio
async def test_get_audit_log_requires_hr_admin(client, db_session):
    hashed = hash_password("password123")
    non_admin = Employee(
        name="Regular Employee",
        email="regular@meridian.com",
        slack_handle="@regular",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(non_admin)
    await db_session.flush()

    login_resp = await client.post(
        "/auth/login", json={"email": "regular@meridian.com", "password": "password123"}
    )
    assert login_resp.status_code == 200

    resp = await client.get("/backup/audit-log")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_audit_log_returns_recent_entries_most_recent_first(
    client, db_session, authenticated_admin
):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    export_resp = await client.get("/backup/export")
    backup_data = export_resp.json()
    backup_data["confirmation_phrase"] = "RESTORE"

    # Restore twice to create two audit log entries.
    for _ in range(2):
        export_resp = await client.get("/backup/export")
        backup_data = export_resp.json()
        backup_data["confirmation_phrase"] = "RESTORE"
        restore_resp = await client.post("/backup/restore", json=backup_data, headers=headers)
        assert restore_resp.status_code == 200

    resp = await client.get("/backup/audit-log")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 2
    assert entries[0]["action"] == "backup_restore"
    assert entries[0]["actor_name"] == admin.name
    # Most recent first.
    assert entries[0]["created_at"] >= entries[1]["created_at"]
