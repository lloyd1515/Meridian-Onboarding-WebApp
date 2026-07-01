import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import get_db

@pytest.mark.asyncio
async def test_liveness():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

@pytest.mark.asyncio
async def test_readiness_success():
    class MockDbSession:
        async def execute(self, statement):
            class MockResult:
                def scalar(self):
                    return 1
            return MockResult()

    async def override_get_db():
        yield MockDbSession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/health/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ready", "database": "connected"}
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_readiness_failure():
    class MockDbSession:
        async def execute(self, statement):
            raise Exception("Connection Refused")

    async def override_get_db():
        yield MockDbSession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/health/ready")
        assert response.status_code == 503
        assert "Readiness check failed" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()
