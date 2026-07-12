import uuid
import pytest
import datetime
from app.core.security import hash_password
from app.models import Employee, ChecklistTemplate
from sqlalchemy import select


@pytest.fixture
async def authenticated_admin(client, db_session):
    hashed = hash_password("password123")
    admin = Employee(
        name="Template Admin",
        email="template.admin@meridian.com",
        slack_handle="@template.admin",
        role="hr_admin",
        department="HR",
        hire_date=datetime.date(2022, 1, 15),
        hashed_password=hashed,
    )
    db_session.add(admin)
    await db_session.flush()

    login_data = {"email": "template.admin@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return admin, csrf_token


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
async def test_list_checklist_templates_requires_hr_admin(client, db_session, authenticated_employee):
    resp = await client.get("/checklist-templates")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_update_delete_checklist_template_requires_hr_admin(client, db_session, authenticated_employee):
    emp, csrf_token = authenticated_employee
    headers = {"X-CSRF-Token": csrf_token}

    create_resp = await client.post(
        "/checklist-templates",
        json={"title": "Sneaky task", "milestone_offset_days": 30},
        headers=headers,
    )
    assert create_resp.status_code == 403


@pytest.mark.asyncio
async def test_checklist_template_crud_as_hr_admin(client, db_session, authenticated_admin):
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    list_resp = await client.get("/checklist-templates")
    assert list_resp.status_code == 200
    initial_count = len(list_resp.json())
    assert initial_count > 0  # seeded via conftest

    create_resp = await client.post(
        "/checklist-templates",
        json={
            "department": None,
            "title": "Read the employee handbook",
            "description": "Skim the handbook before day one.",
            "default_status": "pending",
            "milestone_offset_days": 30,
            "dependency_indices": [],
            "sort_order": 100,
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    template_id = created["id"]
    assert created["title"] == "Read the employee handbook"

    update_resp = await client.put(
        f"/checklist-templates/{template_id}",
        json={"title": "Read the updated employee handbook", "milestone_offset_days": 60},
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["title"] == "Read the updated employee handbook"
    assert updated["milestone_offset_days"] == 60

    delete_resp = await client.delete(f"/checklist-templates/{template_id}", headers=headers)
    assert delete_resp.status_code == 204

    list_after_delete = await client.get("/checklist-templates")
    assert len(list_after_delete.json()) == initial_count


@pytest.mark.asyncio
async def test_update_checklist_template_reflects_in_freshly_seeded_employee_checklist(client, db_session, authenticated_admin):
    """Proves the DB-backed query path actually replaced the hardcoded one:
    editing a template via the API changes what a *newly created* employee's
    seeded checklist looks like."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    stmt = select(ChecklistTemplate).where(
        ChecklistTemplate.department.is_(None),
        ChecklistTemplate.title == "Configure work laptop",
    )
    template = (await db_session.execute(stmt)).scalar_one()

    update_resp = await client.put(
        f"/checklist-templates/{template.id}",
        json={"title": "Configure work laptop (updated)", "milestone_offset_days": 45},
        headers=headers,
    )
    assert update_resp.status_code == 200

    new_id = str(uuid.uuid4())
    payload = {
        "id": new_id,
        "name": "Post-Edit Hire",
        "email": "post.edit.hire@meridian.com",
        "slack_handle": "@post.edit.hire",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2026-08-01",
        "buddy_id": None,
        "hybrid_preference": "HYBRID",
        "assigned_desk": None,
        "hashed_password": "irrelevant-placeholder",
    }
    resp = await client.post("/employees", json=payload, headers=headers)
    assert resp.status_code == 200

    checklist_resp = await client.get(f"/checklists/{new_id}")
    assert checklist_resp.status_code == 200
    tasks = checklist_resp.json()
    titles = {t["title"]: t for t in tasks}
    assert "Configure work laptop (updated)" in titles
    assert titles["Configure work laptop (updated)"]["milestone_offset_days"] == 45
    assert "Configure work laptop" not in titles


@pytest.mark.asyncio
async def test_checklist_template_crud_supports_blocked_by_template_id(client, db_session, authenticated_admin):
    """The blocked_by_template_id field must be settable through the same
    Create/Update schemas as every other HR-editable template field -- that's
    what makes the "blocked by" relationship actually HR-editable end-to-end,
    not just persisted."""
    admin, csrf_token = authenticated_admin
    headers = {"X-CSRF-Token": csrf_token}

    blocker_resp = await client.post(
        "/checklist-templates",
        json={"title": "Blocker task", "milestone_offset_days": 30, "sort_order": 200},
        headers=headers,
    )
    assert blocker_resp.status_code == 201
    blocker_id = blocker_resp.json()["id"]

    dependent_resp = await client.post(
        "/checklist-templates",
        json={
            "title": "Dependent task",
            "milestone_offset_days": 30,
            "sort_order": 201,
            "blocked_by_template_id": blocker_id,
        },
        headers=headers,
    )
    assert dependent_resp.status_code == 201
    dependent = dependent_resp.json()
    assert dependent["blocked_by_template_id"] == blocker_id

    # Clear it back out via update.
    update_resp = await client.put(
        f"/checklist-templates/{dependent['id']}",
        json={"blocked_by_template_id": None},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["blocked_by_template_id"] is None
