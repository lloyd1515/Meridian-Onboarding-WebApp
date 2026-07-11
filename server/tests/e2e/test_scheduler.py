import pytest
import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.security import hash_password
from app.main import app
from app.models import Employee, ScheduleEntry

@pytest.fixture
async def authenticated_user(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="John Scheduler",
        email="john.schedule@meridian.com",
        slack_handle="@john.schedule",
        role="employee",
        department="Engineering",
        hire_date=datetime.date(2025, 1, 1),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    login_data = {"email": "john.schedule@meridian.com", "password": "password123"}
    resp = await client.post("/auth/login", json=login_data)
    assert resp.status_code == 200
    csrf_token = resp.cookies["csrf_token"]
    return emp, csrf_token

@pytest.mark.asyncio
async def test_scheduler_validation_rules(client, db_session, authenticated_user):
    emp, csrf_token = authenticated_user
    headers = {"X-CSRF-Token": csrf_token}

    # 1. POST bookings for a week (John wants 4 office days)
    # Week of July 6, 2026: July 6, 7, 8, 9, 10
    bookings = [
        {"date": "2026-07-06", "status": "office"},
        {"date": "2026-07-07", "status": "office"},
        {"date": "2026-07-08", "status": "office"},
        {"date": "2026-07-09", "status": "office"}, # 4th day
    ]
    
    resp = await client.post("/scheduler", json={"bookings": bookings}, headers=headers)
    assert resp.status_code == 400
    assert "maximum 3 office days" in resp.json()["detail"].lower()

    # 2. POST valid bookings (John wants 2 office, 2 remote)
    valid_bookings = [
        {"date": "2026-07-06", "status": "office"},
        {"date": "2026-07-07", "status": "office"},
        {"date": "2026-07-08", "status": "remote"},
        {"date": "2026-07-09", "status": "remote"},
    ]
    resp_valid = await client.post("/scheduler", json={"bookings": valid_bookings}, headers=headers)
    assert resp_valid.status_code == 200

    # 3. GET scheduler
    get_resp = await client.get("/scheduler")
    assert get_resp.status_code == 200
    entries = get_resp.json()
    # John has 4 entries
    john_entries = [e for e in entries if e["employee_id"] == str(emp.id)]
    assert len(john_entries) == 4


@pytest.mark.asyncio
async def test_preboardee_cannot_book_office_days(client, db_session):
    hashed = hash_password("password123")
    emp = Employee(
        name="Pre Scheduler",
        email="pre.schedule@meridian.com",
        slack_handle="@pre.schedule",
        role="preboardee",
        department="Engineering",
        hire_date=datetime.date.today() + datetime.timedelta(days=3),
        hashed_password=hashed,
    )
    db_session.add(emp)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"email": "pre.schedule@meridian.com", "password": "password123"})
    assert resp.status_code == 200
    headers = {"X-CSRF-Token": resp.cookies["csrf_token"]}

    booking = {"bookings": [{"date": "2026-07-20", "status": "office"}]}
    submit = await client.post("/scheduler", json=booking, headers=headers)
    assert submit.status_code == 403

    # Reading the shared schedule is gated the same way as booking: a
    # pre-boardee can't enumerate everyone else's office days either.
    view = await client.get("/scheduler")
    assert view.status_code == 403


@pytest.mark.asyncio
async def test_capacity_boundaries_warn_at_124_reject_above_130(client, db_session, authenticated_user):
    emp, csrf_token = authenticated_user
    headers = {"X-CSRF-Token": csrf_token}

    async def seed_office_day(day: datetime.date, occupants: int):
        others = [
            Employee(
                name=f"Occupant {day.isoformat()}-{i}",
                email=f"occupant.{day.isoformat()}.{i}@meridian.com",
                slack_handle=f"@occ.{day.isoformat()}.{i}",
                role="employee",
                department="Engineering",
                hire_date=datetime.date(2025, 1, 1),
                hashed_password="x",
            )
            for i in range(occupants)
        ]
        db_session.add_all(others)
        await db_session.flush()
        db_session.add_all([ScheduleEntry(employee_id=o.id, date=day, status="office") for o in others])

    # Three Mondays in different weeks so the 3-day/week rule never interferes.
    quiet_day = datetime.date(2026, 8, 3)     # 122 others -> total 123, below warning
    warn_day = datetime.date(2026, 8, 10)     # 123 others -> total 124, warning fires
    full_day = datetime.date(2026, 8, 17)     # 130 others -> total 131, over cap
    await seed_office_day(quiet_day, 122)
    await seed_office_day(warn_day, 123)
    await seed_office_day(full_day, 130)
    await db_session.commit()

    resp = await client.post("/scheduler", json={"bookings": [{"date": quiet_day.isoformat(), "status": "office"}]}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["warnings"] == []

    resp = await client.post("/scheduler", json={"bookings": [{"date": warn_day.isoformat(), "status": "office"}]}, headers=headers)
    assert resp.status_code == 200
    assert any("high (124 people)" in w for w in resp.json()["warnings"])

    resp = await client.post("/scheduler", json={"bookings": [{"date": full_day.isoformat(), "status": "office"}]}, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_bulk_scheduler_save_not_rate_limited(client, db_session, authenticated_user):
    """Regression test for the HR bulk-save-vs-rate-limit bug: HybridScheduler.tsx's
    save flow POSTs to /scheduler once per employee, sequentially. With the full
    210-employee seed dataset that's ~210 requests from one HR session, which used
    to blow past the general 60-requests/60s IP rate limit and silently drop most
    of the saves. /scheduler now has its own, much more generous limiter
    (SCHEDULER_RATE_LIMIT_MAX_REQUESTS) that isn't touched by tightening the
    general one, so simulate the general limit being far smaller than 210 and
    confirm all 210 sequential scheduler POSTs still succeed."""
    emp, csrf_token = authenticated_user
    headers = {"X-CSRF-Token": csrf_token}

    original_limiter = app.state.limiter
    app.state.limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["5/60second"],
        enabled=True,
    )
    original_scheduler_limiter = app.state.scheduler_limiter
    app.state.scheduler_limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["1000/60second"],
        enabled=True,
    )
    try:
        for i in range(210):
            day = datetime.date(2027, 1, 4) + datetime.timedelta(days=(i % 5))
            resp = await client.post(
                "/scheduler",
                json={"bookings": [{"date": day.isoformat(), "status": "remote"}]},
                headers=headers,
            )
            assert resp.status_code == 200, f"request {i} failed: {resp.status_code} {resp.text}"

        # A request on a route NOT exempted from the general limiter should
        # still be rate limited -- proving the tightened general limiter was
        # actually active and this isn't a false pass from both limiters
        # being disabled.
        blocked = None
        for _ in range(10):
            r = await client.get("/health/live")
            if r.status_code == 429:
                blocked = r
                break
        assert blocked is not None, "general limiter should still apply to non-/scheduler routes"
    finally:
        app.state.limiter = original_limiter
        app.state.scheduler_limiter = original_scheduler_limiter
