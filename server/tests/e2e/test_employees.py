import uuid
import pytest
import datetime
from app.core.security import hash_password
from app.models import Employee


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
