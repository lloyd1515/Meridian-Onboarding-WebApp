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
