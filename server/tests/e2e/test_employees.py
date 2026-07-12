import uuid
import pytest
import datetime
from app.core.security import hash_password, verify_password
from app.models import Employee, ChecklistTask, ScheduleEntry


@pytest.fixture
async def authenticated_admin(client, db_session):
    hashed = hash_password("password123")
    admin = Employee(
        name="Test Admin",
        email="test.admin@meridian.com",
        slack_handle="@test.admin",
        role="hr_admin",
        department="HR",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(admin)
    await db_session.flush()

    login_data = {"email": "test.admin@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return admin, csrf_token


@pytest.mark.asyncio
async def test_add_new_hire_accepts_uuid_and_seeds_department_checklist(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    new_id = str(uuid.uuid4())
    payload = {
        "id": new_id,
        "name": "New Sales Hire",
        "email": "new.sales.hire@meridian.com",
        "slack_handle": "@new.sales.hire",
        "role": "employee",
        "department": "Sales",
        "hire_date": "2026-08-01",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
        "hashed_password": "irrelevant-placeholder",
    }

    resp = await client.post("/employees", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == new_id

    checklist_resp = await client.get(f"/checklists/{new_id}")
    assert checklist_resp.status_code == 200
    tasks = checklist_resp.json()
    assert len(tasks) == 8
    titles = {t["title"] for t in tasks}
    assert "Shadow a client call" in titles  # Sales-specific capstone task
    assert "Submit first Pull Request (PR)" not in titles  # not Engineering


@pytest.mark.asyncio
async def test_new_hire_creation_returns_working_temp_password_not_empty_hash(client, db_session, authenticated_admin):
    """Regression test for the critical bug: the frontend used to always send
    hashed_password='', which meant a new hire's real stored credential was
    the argon2 hash of the empty string -- permanently unable to log in, with
    no recovery path. The fix: the server generates a random temp password,
    hashes *that*, and returns the plaintext once in the response."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    new_id = str(uuid.uuid4())
    payload = {
        "id": new_id,
        "name": "Temp Password Hire",
        "email": "temp.password.hire@meridian.com",
        "slack_handle": "@temp.password.hire",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2026-08-01",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
    }

    resp = await client.post("/employees", json=payload, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    temp_password = body["temporary_password"]
    assert temp_password
    assert len(temp_password) >= 12

    new_emp = await db_session.get(Employee, uuid.UUID(new_id))
    assert not verify_password(new_emp.hashed_password, "")  # not the empty-string hash bug
    assert verify_password(new_emp.hashed_password, temp_password)

    # The temp password must actually work to log in.
    login_resp = await client.post("/auth/login", json={
        "email": "temp.password.hire@meridian.com",
        "password": temp_password,
    })
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_temporary_password_never_returned_on_read(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    new_id = str(uuid.uuid4())
    payload = {
        "id": new_id,
        "name": "Read Safety Hire",
        "email": "read.safety.hire@meridian.com",
        "slack_handle": "@read.safety.hire",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2026-08-01",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
    }
    resp = await client.post("/employees", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["temporary_password"]

    list_resp = await client.get("/employees")
    assert list_resp.status_code == 200
    assert all("temporary_password" not in e for e in list_resp.json())

    me_resp = await client.get("/employees/me")
    assert me_resp.status_code == 200
    assert "temporary_password" not in me_resp.json()


@pytest.mark.asyncio
async def test_existing_employee_update_via_post_employees_ignores_password_field(client, db_session, authenticated_admin):
    """The update branch of POST /employees no longer accepts a password at
    all -- EmployeeSaveInput has no password field, matching the more scoped
    PATCH /employees/{id}. A raw (non-argon2) value sent by any caller must
    have no effect on the stored credential."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    existing = Employee(
        name="Existing Person",
        email="existing.person@meridian.com",
        slack_handle="@existing.person",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hash_password("original-password123"),
    )
    db_session.add(existing)
    await db_session.flush()
    existing_id = str(existing.id)
    original_hash = existing.hashed_password

    payload = {
        "id": existing_id,
        "name": "Existing Person Updated",
        "email": "existing.person@meridian.com",
        "slack_handle": "@existing.person",
        "role": "employee",
        "department": "Sales",
        "hire_date": "2022-01-15",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
        "hashed_password": "attacker-supplied-plaintext",
    }
    resp = await client.post("/employees", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["temporary_password"] is None

    await db_session.refresh(existing)
    assert existing.department == "Sales"  # other fields still update
    assert existing.hashed_password == original_hash  # password untouched
    assert existing.hashed_password != "attacker-supplied-plaintext"


@pytest.fixture
async def authenticated_employee(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Regular Employee",
        email="regular.employee@meridian.com",
        slack_handle="@regular.employee",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    login_data = {"email": "regular.employee@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return emp, csrf_token


@pytest.fixture
async def authenticated_preboardee(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Future New Hire",
        email="future.hire@meridian.com",
        slack_handle="@future.hire",
        role="preboardee",
        department="Engineering",
        hire_date=datetime.date(2099, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    login_data = {"email": "future.hire@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return emp, csrf_token


@pytest.mark.asyncio
async def test_list_employees_allows_preboardee_role(client, db_session, authenticated_preboardee):
    # Regression test: GET /employees used to exclude the "preboardee" role,
    # which broke buddy/colleague resolution for preboarding accounts (their
    # buddy_id is set correctly server-side, but the frontend's buddy lookup
    # scans this list and would silently fall back to "no buddy").
    emp, _csrf_token = authenticated_preboardee
    resp = await client.get("/employees")
    assert resp.status_code == 200
    emails = {e["email"] for e in resp.json()}
    assert emp.email in emails


@pytest.mark.asyncio
async def test_patch_employee_updates_editable_fields(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    buddy = Employee(
        name="Buddy One",
        email="buddy.one@meridian.com",
        slack_handle="@buddy.one",
        role="buddy",
        department="Engineering",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hash_password("password123"),
    )
    target = Employee(
        name="Target Employee",
        email="target.employee@meridian.com",
        slack_handle="@target.employee",
        role="employee",
        department="Sales",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hash_password("password123"),
        hybrid_preference="REMOTE",
        assigned_desk=None,
    )
    db_session.add_all([buddy, target])
    await db_session.flush()

    resp = await client.patch(
        f"/employees/{target.id}",
        json={
            "department": "Engineering",
            "buddy_id": str(buddy.id),
            "hybrid_preference": "HYBRID",
            "assigned_desk": "D-42",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["department"] == "Engineering"
    assert body["buddy_id"] == str(buddy.id)
    assert body["hybrid_preference"] == "HYBRID"
    assert body["assigned_desk"] == "D-42"
    # Fields excluded from this endpoint's scope must be untouched
    assert body["name"] == "Target Employee"
    assert body["email"] == "target.employee@meridian.com"
    assert body["role"] == "employee"


@pytest.mark.asyncio
async def test_patch_employee_partial_update_does_not_clobber_other_fields(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    target = Employee(
        name="Partial Update Target",
        email="partial.target@meridian.com",
        slack_handle="@partial.target",
        role="employee",
        department="Marketing",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hash_password("password123"),
        hybrid_preference="OFFICE",
        assigned_desk="D-1",
    )
    db_session.add(target)
    await db_session.flush()

    resp = await client.patch(
        f"/employees/{target.id}",
        json={"department": "Finance"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["department"] == "Finance"
    # Untouched fields survive the partial update
    assert body["hybrid_preference"] == "OFFICE"
    assert body["assigned_desk"] == "D-1"
    assert body["buddy_id"] is None


@pytest.mark.asyncio
async def test_patch_employee_rejects_nonexistent_buddy(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    target = Employee(
        name="Buddy Validation Target",
        email="buddy.validation.target@meridian.com",
        slack_handle="@buddy.validation.target",
        role="employee",
        department="Sales",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hash_password("password123"),
    )
    db_session.add(target)
    await db_session.flush()

    fake_buddy_id = str(uuid.uuid4())
    resp = await client.patch(
        f"/employees/{target.id}",
        json={"buddy_id": fake_buddy_id},
        headers=headers,
    )
    assert resp.status_code == 400

    await db_session.refresh(target)
    assert target.buddy_id is None


@pytest.mark.asyncio
async def test_patch_employee_requires_hr_admin(client, db_session, authenticated_employee):
    emp, csrf_token = authenticated_employee
    headers = {"X-CSRF-Token": csrf_token}

    resp = await client.patch(
        f"/employees/{emp.id}",
        json={"department": "Finance"},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_employee_creation_rejects_invalid_enum_values_and_domain(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    base = {
        "id": str(uuid.uuid4()),
        "name": "Bad Input",
        "email": "bad.input@meridian.com",
        "slack_handle": "@bad.input",
        "role": "employee",
        "department": "Sales",
        "hire_date": "2026-08-01",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
        "hashed_password": "irrelevant-placeholder",
    }

    # role outside the known set
    resp = await client.post("/employees", json={**base, "role": "superadmin"}, headers=headers)
    assert resp.status_code == 422

    # hybrid_preference outside the known set
    resp = await client.post("/employees", json={**base, "hybrid_preference": "SOMETIMES"}, headers=headers)
    assert resp.status_code == 422

    # non-company email domain
    resp = await client.post("/employees", json={**base, "email": "bad.input@gmail.com"}, headers=headers)
    assert resp.status_code == 422


@pytest.fixture
async def authenticated_buddy(client, db_session):
    hashed = hash_password("password123")
    buddy = Employee(
        name="Buddy Account",
        email="buddy.account@meridian.com",
        slack_handle="@buddy.account",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(buddy)
    await db_session.flush()

    login_data = {"email": "buddy.account@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return buddy, csrf_token


@pytest.mark.asyncio
async def test_buddy_view_returns_empty_list_for_non_buddy(client, db_session, authenticated_buddy):
    buddy, _ = authenticated_buddy

    resp = await client.get("/employees/me/buddy-view")
    assert resp.status_code == 200
    assert resp.json() == {"hires": []}


@pytest.mark.asyncio
async def test_buddy_view_lists_hires_and_flags_stuck_tasks(client, db_session, authenticated_buddy):
    buddy, _ = authenticated_buddy

    today = datetime.date.today()
    hire = Employee(
        name="Mentored Hire",
        email="mentored.hire@meridian.com",
        slack_handle="@mentored.hire",
        role="employee",
        department="Sales",
        hire_date=today - datetime.timedelta(days=10),
        buddy_id=buddy.id,
        hashed_password=hash_password("password123"),
    )
    db_session.add(hire)
    await db_session.flush()

    completed_task = ChecklistTask(
        employee_id=hire.id, title="Sign contract", status="completed", dependencies=[],
    )
    blocked_task = ChecklistTask(
        employee_id=hire.id, title="Install security software", status="blocked", dependencies=[],
    )
    overdue_task = ChecklistTask(
        employee_id=hire.id, title="Meet the team", status="pending", dependencies=[],
        due_date=today - datetime.timedelta(days=2),
    )
    upcoming_task = ChecklistTask(
        employee_id=hire.id, title="Submit first PR", status="pending", dependencies=[],
        due_date=today + datetime.timedelta(days=5),
    )
    db_session.add_all([completed_task, blocked_task, overdue_task, upcoming_task])
    await db_session.commit()

    resp = await client.get("/employees/me/buddy-view")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["hires"]) == 1

    entry = body["hires"][0]
    assert entry["employee"]["id"] == str(hire.id)
    assert entry["employee"]["name"] == "Mentored Hire"
    assert entry["employee"]["department"] == "Sales"
    assert entry["total_tasks"] == 4
    assert entry["completed_tasks"] == 1

    stuck_titles = {t["title"] for t in entry["stuck_tasks"]}
    assert stuck_titles == {"Install security software", "Meet the team"}


@pytest.mark.asyncio
async def test_agenda_ics_returns_five_valid_vevents(client, db_session, authenticated_employee):
    """The dashboard's 'Download .ics' export: one VEVENT per weekday of the
    current week, reflecting real ScheduleEntry office/remote days and a
    focus task pulled from the employee's own open checklist tasks."""
    emp, csrf_token = authenticated_employee

    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())

    db_session.add(ScheduleEntry(employee_id=emp.id, date=monday, status="office"))
    db_session.add(ChecklistTask(
        employee_id=emp.id, title="Finish onboarding survey", status="pending", dependencies=[],
    ))
    await db_session.commit()

    resp = await client.get("/employees/me/agenda.ics")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/calendar")
    assert 'attachment; filename="agenda.ics"' in resp.headers["content-disposition"]

    body = resp.text
    assert body.startswith("BEGIN:VCALENDAR\r\n")
    assert body.rstrip("\r\n").endswith("END:VCALENDAR")
    assert body.count("BEGIN:VEVENT") == 5
    assert body.count("END:VEVENT") == 5
    for field in ["UID:", "DTSTAMP:", "DTSTART;VALUE=DATE:", "DTEND;VALUE=DATE:", "SUMMARY:", "DESCRIPTION:"]:
        assert body.count(field) == 5

    monday_str = monday.strftime("%Y%m%d")
    assert f"DTSTART;VALUE=DATE:{monday_str}" in body
    assert "In Office" in body
    assert "Finish onboarding survey" in body


@pytest.mark.asyncio
async def test_agenda_ics_requires_authentication(client, db_session):
    resp = await client.get("/employees/me/agenda.ics")
    assert resp.status_code == 401
