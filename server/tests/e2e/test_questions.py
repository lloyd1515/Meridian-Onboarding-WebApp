import datetime
import pytest
from app.core.security import hash_password
from app.models import Employee


@pytest.fixture
async def two_employees_and_admin(client, db_session):
    hashed = hash_password("password123")

    employee_one = Employee(
        name="Question Asker", email="asker@meridian.com", slack_handle="@asker",
        role="employee", department="Engineering", hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    employee_two = Employee(
        name="Other Employee", email="other@meridian.com", slack_handle="@other",
        role="employee", department="Sales", hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    admin = Employee(
        name="HR Admin", email="hr.questions@meridian.com", slack_handle="@hr.questions",
        role="hr_admin", department="HR", hire_date=datetime.date(2022, 1, 1),
        hashed_password=hashed,
    )
    db_session.add_all([employee_one, employee_two, admin])
    await db_session.commit()
    return employee_one, employee_two, admin


async def login(client, email):
    resp = await client.post("/auth/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200
    return resp.cookies["csrf_token"]


@pytest.mark.asyncio
async def test_employee_can_create_and_list_only_own_questions(client, db_session, two_employees_and_admin):
    employee_one, employee_two, _ = two_employees_and_admin

    csrf_one = await login(client, employee_one.email)
    create_resp = await client.post(
        "/questions",
        json={"subject": "VPN access", "body": "How do I get VPN access set up?"},
        headers={"X-CSRF-Token": csrf_one},
    )
    assert create_resp.status_code == 201
    body = create_resp.json()
    assert body["status"] == "open"
    assert body["employee_id"] == str(employee_one.id)
    assert body["employee_name"] == employee_one.name

    list_resp = await client.get("/questions")
    assert list_resp.status_code == 200
    questions = list_resp.json()
    assert len(questions) == 1
    assert questions[0]["subject"] == "VPN access"

    await client.post("/auth/logout", headers={"X-CSRF-Token": csrf_one})

    # employee_two has no questions of their own and cannot see employee_one's
    csrf_two = await login(client, employee_two.email)
    other_list_resp = await client.get("/questions")
    assert other_list_resp.status_code == 200
    assert other_list_resp.json() == []


@pytest.mark.asyncio
async def test_hr_admin_sees_all_questions_and_can_answer(client, db_session, two_employees_and_admin):
    employee_one, employee_two, admin = two_employees_and_admin

    csrf_one = await login(client, employee_one.email)
    resp_one = await client.post(
        "/questions",
        json={"subject": "Payroll date", "body": "When is the first payroll run?"},
        headers={"X-CSRF-Token": csrf_one},
    )
    question_id = resp_one.json()["id"]
    await client.post("/auth/logout", headers={"X-CSRF-Token": csrf_one})

    # Logging into the same identity twice within the same test mints an
    # identical JWT (exp truncates to the second), which then collides on
    # the refresh_tokens.token unique constraint -- so each identity below
    # logs in exactly once and is reused for both its own actions and the
    # "non-admin cannot answer" check.
    csrf_two = await login(client, employee_two.email)
    await client.post(
        "/questions",
        json={"subject": "Desk assignment", "body": "Where is my desk?"},
        headers={"X-CSRF-Token": csrf_two},
    )
    forbidden_resp = await client.post(
        f"/questions/{question_id}/answer",
        json={"answer": "Not allowed"},
        headers={"X-CSRF-Token": csrf_two},
    )
    assert forbidden_resp.status_code == 403
    await client.post("/auth/logout", headers={"X-CSRF-Token": csrf_two})

    # Admin sees both employees' questions
    csrf_admin = await login(client, admin.email)
    all_resp = await client.get("/questions")
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 2

    answer_resp = await client.post(
        f"/questions/{question_id}/answer",
        json={"answer": "Payroll runs on the last business day of the month."},
        headers={"X-CSRF-Token": csrf_admin},
    )
    assert answer_resp.status_code == 200
    answered = answer_resp.json()
    assert answered["status"] == "answered"
    assert answered["answer"] == "Payroll runs on the last business day of the month."
    assert answered["answered_at"] is not None
