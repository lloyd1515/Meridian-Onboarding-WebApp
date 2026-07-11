import datetime
import pytest
from app.core.security import hash_password
from app.models import Employee, ChecklistTask

@pytest.fixture
async def authenticated_newhire(client, db_session):
    # A new hire who has already started (past hire_date, not pre-boarding):
    # this fixture exercises the checklist workflow itself, not pre-boarding gating.
    hashed = hash_password("password123")
    import datetime
    emp = Employee(
        name="Jane Doe",
        email="jane.doe@meridian.com",
        slack_handle="@jane.doe",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2026, 7, 1),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    # Log in
    login_data = {"email": "jane.doe@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    
    # Store CSRF token
    csrf_token = resp.cookies["csrf_token"]
    
    # Return user details, user ID and csrf token
    return emp, csrf_token

@pytest.mark.asyncio
async def test_checklist_workflows(client, db_session, authenticated_newhire):
    emp, csrf_token = authenticated_newhire
    headers = {"X-CSRF-Token": csrf_token}

    # 1. Create dependencies: task1 (parent) -> task2 (child, blocked)
    task1 = ChecklistTask(
        employee_id=emp.id,
        title="Parent Task",
        status="pending",
        dependencies=[]
    )
    db_session.add(task1)
    await db_session.flush()

    task2 = ChecklistTask(
        employee_id=emp.id,
        title="Child Task",
        status="blocked",
        blocked_by=task1.id,
        dependencies=[str(task1.id)]
    )
    db_session.add(task2)
    await db_session.commit()

    # 2. Get checklists
    resp = await client.get("/checklists")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 2

    # 3. Complete Parent Task
    comp_resp = await client.post(f"/checklists/{task1.id}/complete", headers=headers)
    assert comp_resp.status_code == 200

    # 4. Check that Child Task is now unblocked
    check_resp = await client.get("/checklists")
    tasks_after = check_resp.json()
    
    child = next(t for t in tasks_after if t["id"] == str(task2.id))
    assert child["status"] == "pending"
    assert child["blocked_by"] is None

    # 5. Skip Child Task
    skip_payload = {"skip_reason": "Not applicable for my role"}
    skip_resp = await client.post(f"/checklists/{task2.id}/skip", json=skip_payload, headers=headers)
    assert skip_resp.status_code == 200
    
    check_skipped = await client.get("/checklists")
    skipped_tasks = check_skipped.json()
    child_skipped = next(t for t in skipped_tasks if t["id"] == str(task2.id))
    assert child_skipped["status"] == "skipped"
    assert child_skipped["skip_reason"] == "Not applicable for my role"


@pytest.fixture
async def authenticated_preboardee(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Pre Boardee",
        email="pre.boardee@meridian.com",
        slack_handle="@pre.boardee",
        role="preboardee",
        department="Engineering",
        hire_date=datetime.date.today() + datetime.timedelta(days=3),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"email": "pre.boardee@meridian.com", "password": "password123"})
    assert resp.status_code == 200
    return emp, resp.cookies["csrf_token"]


@pytest.mark.asyncio
async def test_preboardee_cannot_complete_or_skip_tasks(client, db_session, authenticated_preboardee):
    emp, csrf_token = authenticated_preboardee
    headers = {"X-CSRF-Token": csrf_token}

    task = ChecklistTask(employee_id=emp.id, title="Sign contract", status="pending", dependencies=[])
    db_session.add(task)
    await db_session.commit()

    # Preview is allowed...
    resp = await client.get("/checklists")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # ...but acting on tasks before the start date is not.
    comp_resp = await client.post(f"/checklists/{task.id}/complete", headers=headers)
    assert comp_resp.status_code == 403

    skip_resp = await client.post(f"/checklists/{task.id}/skip", json={"skip_reason": "nope"}, headers=headers)
    assert skip_resp.status_code == 403

    # And the task is untouched.
    check = await client.get("/checklists")
    assert check.json()[0]["status"] == "pending"


@pytest.mark.asyncio
async def test_complete_task_sets_completed_at(client, db_session, authenticated_newhire):
    emp, csrf_token = authenticated_newhire
    headers = {"X-CSRF-Token": csrf_token}

    task = ChecklistTask(employee_id=emp.id, title="Task to complete", status="pending", dependencies=[])
    db_session.add(task)
    await db_session.commit()

    before = datetime.datetime.utcnow()
    resp = await client.post(f"/checklists/{task.id}/complete", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["completed_at"] is not None
    completed_at = datetime.datetime.fromisoformat(body["completed_at"])
    assert completed_at >= before


@pytest.mark.asyncio
async def test_backdated_task_is_flagged_overdue_via_due_date(client, db_session, authenticated_newhire):
    emp, csrf_token = authenticated_newhire

    overdue_task = ChecklistTask(
        employee_id=emp.id,
        title="Overdue task",
        status="pending",
        dependencies=[],
        due_date=datetime.date.today() - datetime.timedelta(days=5),
    )
    upcoming_task = ChecklistTask(
        employee_id=emp.id,
        title="Not-yet-due task",
        status="pending",
        dependencies=[],
        due_date=datetime.date.today() + datetime.timedelta(days=5),
    )
    db_session.add_all([overdue_task, upcoming_task])
    await db_session.commit()

    resp = await client.get("/checklists")
    assert resp.status_code == 200
    tasks = {t["title"]: t for t in resp.json()}

    overdue = tasks["Overdue task"]
    assert overdue["due_date"] == (datetime.date.today() - datetime.timedelta(days=5)).isoformat()
    assert overdue["status"] != "completed"
    # The API only reports due_date; the client is responsible for the
    # "is it overdue" comparison against today, but we assert the raw data
    # needed to make that call is present and correct here.
    assert datetime.date.fromisoformat(overdue["due_date"]) < datetime.date.today()

    not_yet = tasks["Not-yet-due task"]
    assert datetime.date.fromisoformat(not_yet["due_date"]) > datetime.date.today()


@pytest.mark.asyncio
async def test_get_all_checklists_admin_only_and_aggregates_across_employees(client, db_session):
    hashed = hash_password("password123")

    employee_one = Employee(
        name="Employee One", email="one@meridian.com", slack_handle="@one",
        role="employee", department="Engineering", hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    employee_two = Employee(
        name="Employee Two", email="two@meridian.com", slack_handle="@two",
        role="employee", department="Sales", hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    admin = Employee(
        name="Admin", email="admin.checklists@meridian.com", slack_handle="@admin",
        role="hr_admin", department="HR", hire_date=datetime.date(2022, 1, 1),
        hashed_password=hashed,
    )
    db_session.add_all([employee_one, employee_two, admin])
    await db_session.flush()

    db_session.add(ChecklistTask(employee_id=employee_one.id, title="Task A", status="pending", dependencies=[]))
    db_session.add(ChecklistTask(employee_id=employee_two.id, title="Task B", status="completed", dependencies=[]))
    await db_session.commit()

    # Non-admin is forbidden
    login_resp = await client.post("/auth/login", json={"email": "one@meridian.com", "password": "password123"})
    assert login_resp.status_code == 200
    forbidden_resp = await client.get("/checklists/all")
    assert forbidden_resp.status_code == 403
    await client.post("/auth/logout", headers={"X-CSRF-Token": login_resp.cookies["csrf_token"]})

    # Admin sees tasks for every employee, not just their own
    admin_login = await client.post("/auth/login", json={"email": "admin.checklists@meridian.com", "password": "password123"})
    assert admin_login.status_code == 200
    all_resp = await client.get("/checklists/all")
    assert all_resp.status_code == 200
    employee_ids = {t["employee_id"] for t in all_resp.json()}
    assert str(employee_one.id) in employee_ids
    assert str(employee_two.id) in employee_ids
