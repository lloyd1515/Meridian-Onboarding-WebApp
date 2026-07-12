import datetime
import pytest
from app.core.security import hash_password
from app.core.config import settings
from app.models import Employee
from app.routes import notifications


@pytest.fixture
async def employee(db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Slack Sender", email="slacksender@meridian.com", slack_handle="@slacksender",
        role="employee", department="Engineering", hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.commit()
    return emp


async def login(client, email):
    resp = await client.post("/auth/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200
    return resp.cookies["csrf_token"]


@pytest.mark.asyncio
async def test_slack_status_not_configured_by_default(client, db_session, employee):
    csrf = await login(client, employee.email)
    resp = await client.get("/notifications/slack/status", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 200
    assert resp.json() == {"sent": False, "configured": False}


@pytest.mark.asyncio
async def test_send_slack_message_not_configured_is_graceful_noop(client, db_session, employee):
    csrf = await login(client, employee.email)
    resp = await client.post(
        "/notifications/slack",
        json={"message": "Hi @buddy, I'm new here!"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200
    assert resp.json() == {"sent": False, "configured": False}


@pytest.mark.asyncio
async def test_send_slack_message_configured_posts_via_webhook(client, db_session, employee, monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.example/services/T000/B000/XXXX")

    captured = {}

    def fake_post(webhook_url, message):
        captured["webhook_url"] = webhook_url
        captured["message"] = message
        return True

    monkeypatch.setattr(notifications, "_post_to_slack", fake_post)

    csrf = await login(client, employee.email)
    resp = await client.post(
        "/notifications/slack",
        json={"message": "Hi @buddy, I'm new here!"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200
    assert resp.json() == {"sent": True, "configured": True}
    assert captured["webhook_url"] == "https://hooks.slack.example/services/T000/B000/XXXX"
    assert captured["message"] == "Hi @buddy, I'm new here!"


@pytest.mark.asyncio
async def test_send_slack_message_webhook_failure_reports_not_sent(client, db_session, employee, monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.example/services/T000/B000/XXXX")
    monkeypatch.setattr(notifications, "_post_to_slack", lambda webhook_url, message: False)

    csrf = await login(client, employee.email)
    resp = await client.post(
        "/notifications/slack",
        json={"message": "Hi @buddy!"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200
    assert resp.json() == {"sent": False, "configured": True}


@pytest.mark.asyncio
async def test_send_slack_message_requires_auth(client):
    resp = await client.post("/notifications/slack", json={"message": "hi"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_send_slack_message_rejects_empty_message(client, db_session, employee):
    csrf = await login(client, employee.email)
    resp = await client.post(
        "/notifications/slack",
        json={"message": ""},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 422
