import datetime

from app.core.dependencies import is_hr_admin
from app.models import Employee


def _employee(role: str, hire_date: datetime.date) -> Employee:
    return Employee(
        name="Test User",
        email="test.user@meridian.com",
        slack_handle="@test.user",
        role=role,
        department="Engineering",
        hire_date=hire_date,
        hashed_password="hash",
    )


def test_is_hr_admin_true_for_active_hr_admin():
    emp = _employee("hr_admin", datetime.date(2020, 1, 1))
    assert is_hr_admin(emp) is True


def test_is_hr_admin_false_for_employee():
    emp = _employee("employee", datetime.date(2020, 1, 1))
    assert is_hr_admin(emp) is False


def test_is_hr_admin_false_for_hr_admin_who_has_not_started_yet():
    # Effective role falls back to "preboardee" before hire_date, even for
    # someone whose stored role is hr_admin (mirrors get_effective_role).
    future = datetime.date.today() + datetime.timedelta(days=30)
    emp = _employee("hr_admin", future)
    assert is_hr_admin(emp) is False
