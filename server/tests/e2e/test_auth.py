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
async def test_signup_flow(client, db_session):
    signup_data = {
        "name": "Signup User",
        "email": "signup.user@meridian.com",
        "slack_handle": "@signup.user",
        "role": "employee",
        "department": "Engineering",
        "hire_date": "2025-05-01",
        "password": "password123",
        "hybrid_preference": "HIBRID"
    }
    response = await client.post("/auth/signup", json=signup_data)
    assert response.status_code == 200
    assert response.json()["email"] == "signup.user@meridian.com"
    assert "access_token" in response.cookies

def datetime_date_helper():
    import datetime
    return datetime.date(2025, 1, 1)

