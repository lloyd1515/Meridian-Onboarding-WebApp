import pytest
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.main import app


@pytest.mark.asyncio
async def test_exceeding_rate_limit_returns_429(client):
    """The pytest suite runs with the limiter disabled (ENVIRONMENT=testing,
    see conftest.py) so the other ~50 tests aren't flaky. This test swaps in
    a small, enabled limiter for the duration of the test to verify the
    429 wiring itself actually works, then restores the original limiter."""
    original_limiter = app.state.limiter
    max_requests = 3
    app.state.limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[f"{max_requests}/60second"],
        enabled=True,
    )
    try:
        for _ in range(max_requests):
            resp = await client.get("/health/live")
            assert resp.status_code == 200

        resp = await client.get("/health/live")
        assert resp.status_code == 429
        body = resp.json()
        assert body["message"] == "Too many requests"
        assert "detail" in body
    finally:
        app.state.limiter = original_limiter
