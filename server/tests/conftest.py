import os

# Must be set before any app.* module is imported: app.core.config.settings is
# a module-level singleton read once at import time, and the rate limiter in
# app.main is disabled when ENVIRONMENT == "testing" so the pytest suite's
# repeated hits to the same endpoints don't trip it (see test_rate_limit.py
# for a dedicated test with the limiter re-enabled).
os.environ["ENVIRONMENT"] = "testing"

import asyncio
import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.main import app

# Import models to ensure they register on Base.metadata
from app.models import Employee, ChecklistTask, ChecklistTemplate, ScheduleEntry, Question

# SQLite in-memory database URL for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Mirrors the seed data baked into alembic/versions/a1c2e3f4b5d6_add_checklist_templates_table.py
# (the migration is self-contained and doesn't import this, by design -- see
# that file's docstring). Tests recreate the schema from scratch each time
# rather than running migrations, so the checklist_templates table needs its
# own seeding here to keep seed_checklist_tasks()'s behavior exercised.
_CORE_TASKS = [
    {"title": "Sign employment contract", "description": "Complete electronic signing of your contract and annexes in the portal.", "status": "completed", "deps": [], "milestone_offset_days": 30},
    {"title": "Configure work laptop", "description": "Install operating system, VPN client, and core development tools.", "status": "in_progress", "deps": [], "milestone_offset_days": 30},
    {"title": "First meeting with Buddy", "description": "Schedule a 30-minute Zoom or coffee meet to get to know each other.", "status": "pending", "deps": [1], "milestone_offset_days": 30},
    {"title": "Install corporate security software", "description": "Install the local security agent before accessing the internal network.", "status": "blocked", "deps": [1, 2], "milestone_offset_days": 60},
    {"title": "Information security training", "description": "Complete the mandatory interactive training on the HR platform.", "status": "pending", "deps": [0], "milestone_offset_days": 60},
    {"title": "Meet the team members", "description": "Schedule informal 1-on-1 chats with other teammates in your department.", "status": "pending", "deps": [], "milestone_offset_days": 60},
]
_DEPARTMENT_CAPSTONE = {
    "Engineering": [
        {"title": "Submit first Pull Request (PR)", "description": "Fix a small bug or implement a minor change in the main codebase.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Present a mini-demo", "description": "Showcase your completed project during the weekly engineering sync.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Sales": [
        {"title": "Shadow a client call", "description": "Sit in on a live sales call with your manager or buddy to see the pitch in action.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Deliver your first prospect pitch", "description": "Present a practice pitch to your manager and get feedback.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Marketing": [
        {"title": "Draft a sample campaign brief", "description": "Put together a short campaign brief following the team's template.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Present your brief in the weekly sync", "description": "Walk the marketing team through your sample campaign brief.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "Finance": [
        {"title": "Complete a mock month-end reconciliation", "description": "Work through a practice reconciliation with your buddy using a sample ledger.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Walk your manager through the reconciliation", "description": "Present your mock reconciliation and talk through your approach.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
    "HR": [
        {"title": "Shadow an onboarding session", "description": "Sit in on another new hire's onboarding session or checklist review.", "status": "pending", "deps": [1], "milestone_offset_days": 90},
        {"title": "Run a mock onboarding session", "description": "Practice running a short onboarding session and get feedback from the team.", "status": "pending", "deps": [6], "milestone_offset_days": 90},
    ],
}


async def _seed_checklist_templates(session: AsyncSession) -> None:
    for idx, t in enumerate(_CORE_TASKS):
        session.add(ChecklistTemplate(
            department=None,
            title=t["title"],
            description=t["description"],
            default_status=t["status"],
            milestone_offset_days=t["milestone_offset_days"],
            dependency_indices=t["deps"],
            sort_order=idx,
        ))
    for department, capstone_tasks in _DEPARTMENT_CAPSTONE.items():
        for offset, t in enumerate(capstone_tasks):
            session.add(ChecklistTemplate(
                department=department,
                title=t["title"],
                description=t["description"],
                default_status=t["status"],
                milestone_offset_days=t["milestone_offset_days"],
                dependency_indices=t["deps"],
                sort_order=len(_CORE_TASKS) + offset,
            ))
    await session.commit()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the session."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create async engine for tests with sqlite in-memory."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    # SQLite doesn't enforce FK constraints unless explicitly told to.
    # Production runs on Postgres, where checklist_tasks.blocked_by and
    # employees.buddy_id are real, enforced FKs -- enable the same
    # enforcement here so tests can actually catch FK-ordering bugs instead
    # of silently passing on the (weaker) default SQLite behavior.
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(test_engine):
    """Provide a clean database session for tests by recreating tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async_session = sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        await _seed_checklist_templates(session)
        yield session
        await session.close()

@pytest_asyncio.fixture
async def client(db_session):
    """Provide an HTTPX async client for E2E tests, overriding get_db dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
