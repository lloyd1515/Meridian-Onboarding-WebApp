import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models import Employee

@pytest.mark.asyncio
async def test_auth_flow(client, db_session):
    # 1. Create a test employee
    hashed = hash_password("password123")
    emp = Employee(
        name="Test User",
        email="test.user@meridian.com",
        slack_handle="@test.user",
        role="employee",
        department="Engineering",
        hire_date=datetime_date_helper(),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    # 2. Login
    login_data = {"email": "test.user@meridian.com", "password": "password123"}
    response = await client.post("/auth/login", json=login_data)
    assert response.status_code == 200
    
    # Check cookies
    cookies = response.cookies
    assert "access_token" in cookies
    assert "refresh_token" in cookies
    assert "csrf_token" in cookies # CSRF is non-HttpOnly
    
    csrf_token = cookies["csrf_token"]

    # 3. Access /employees/me using credentials
    me_resp = await client.get("/employees/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "test.user@meridian.com"

    # 4. Logout (with CSRF header)
    headers = {"X-CSRF-Token": csrf_token}
    logout_resp = await client.post("/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert "access_token" not in client.cookies or client.cookies.get("access_token") == ""

@pytest.mark.asyncio
async def test_login_rejects_wrong_password(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Test User",
        email="wrongpass.user@meridian.com",
        slack_handle="@wrongpass.user",
        role="employee",
        department="Engineering",
        hire_date=datetime_date_helper(),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    response = await client.post("/auth/login", json={
        "email": "wrongpass.user@meridian.com",
        "password": "not-the-right-password",
    })
    assert response.status_code == 401
    assert "access_token" not in response.cookies


@pytest.mark.asyncio
async def test_signup_requires_min_length_password(client, db_session):
    signup_data = {
        "name": "Short Password User",
        "email": "shortpass.user@meridian.com",
        "slack_handle": "@shortpass.user",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2025-05-01",
        "password": "short",
        "hybrid_preference": "HYBRID",
    }
    response = await client.post("/auth/signup", json=signup_data)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_signup_flow(client, db_session):
    signup_data = {
        "name": "Signup User",
        "email": "signup.user@meridian.com",
        "slack_handle": "@signup.user",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2025-05-01",
        "password": "password123",
        "hybrid_preference": "HYBRID"
    }
    response = await client.post("/auth/signup", json=signup_data)
    assert response.status_code == 200
    assert response.json()["email"] == "signup.user@meridian.com"
    assert "access_token" in response.cookies

def datetime_date_helper():
    import datetime
    return datetime.date(2025, 1, 1)



@pytest.mark.asyncio
async def test_signup_immediately_followed_by_login_does_not_collide(client, db_session):
    # Regression test: signup mints a refresh token, and the frontend immediately
    # calls /auth/login right after a successful signup. Both calls can happen in
    # the same wall-clock second for the same user, so without a unique jti claim
    # the two refresh-token JWTs are byte-identical and the second insert trips
    # the DB's unique constraint on RefreshToken.token (surfaced as a 409).
    signup_data = {
        "name": "Race Condition User",
        "email": "race.user@meridian.com",
        "slack_handle": "@race.user",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2025-05-01",
        "password": "password123",
        "hybrid_preference": "HYBRID",
    }
    signup_resp = await client.post("/auth/signup", json=signup_data)
    assert signup_resp.status_code == 200

    login_resp = await client.post("/auth/login", json={
        "email": "race.user@meridian.com",
        "password": "password123",
    })
    assert login_resp.status_code == 200
    assert "refresh_token" in login_resp.cookies


def test_create_refresh_token_same_second_calls_are_unique():
    from app.core.security import create_refresh_token

    token_a = create_refresh_token({"sub": "same.second@meridian.com"})
    token_b = create_refresh_token({"sub": "same.second@meridian.com"})
    assert token_a != token_b


@pytest.mark.asyncio
async def test_auth_rejects_non_meridian_email_domain(client, db_session):
    signup_data = {
        "name": "Outside R",
        "email": "outsider@example.com",
        "slack_handle": "@outsider",
        "department": "Engineering",
        "hire_date": "2026-08-01",
        "password": "longenough123",
    }
    resp = await client.post("/auth/signup", json=signup_data)
    assert resp.status_code == 422

    resp = await client.post("/auth/login", json={"email": "outsider@example.com", "password": "whatever123"})
    assert resp.status_code == 422
