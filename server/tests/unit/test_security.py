import time
import pytest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token

def test_password_hashing():
    pwd = "my-secure-password"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, pwd) is True
    assert verify_password(hashed, "wrong-password") is False

def test_jwt_tokens():
    data = {"email": "user@meridian.com", "role": "employee"}
    access_token = create_access_token(data)
    refresh_token = create_refresh_token(data)

    assert access_token != refresh_token

    payload_access = verify_token(access_token)
    assert payload_access["email"] == "user@meridian.com"
    assert payload_access["role"] == "employee"

    payload_refresh = verify_token(refresh_token)
    assert payload_refresh["email"] == "user@meridian.com"
    assert payload_refresh["role"] == "employee"

def test_expired_token():
    # Verify expired token returns None
    from datetime import timedelta
    data = {"sub": "user"}
    token = create_access_token(data, expires_delta=timedelta(seconds=-10))
    assert verify_token(token) is None
