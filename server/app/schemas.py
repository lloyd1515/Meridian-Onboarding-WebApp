from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import date, datetime
from typing import Literal, Optional

# Mirrors the frontend's zod .endsWith("@meridian.com") rule (src/services/db.ts) —
# this is an internal tool, only company addresses exist.
def _require_meridian_domain(value: str) -> str:
    if not value.lower().endswith("@meridian.com"):
        raise ValueError("Email must be a @meridian.com address")
    return value

EmployeeRole = Literal["hr_admin", "employee", "preboardee", "buddy"]
HybridPreference = Literal["OFFICE", "REMOTE", "HYBRID"]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    _domain = field_validator("email")(_require_meridian_domain)

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    slack_handle: str
    department: str
    hire_date: date
    password: str = Field(min_length=8)
    hybrid_preference: Optional[HybridPreference] = "HYBRID"

    _domain = field_validator("email")(_require_meridian_domain)


class EmployeeOut(BaseModel):
    id: UUID
    name: str
    email: str
    slack_handle: str
    role: str
    department: str
    hire_date: date
    buddy_id: Optional[UUID] = None
    hybrid_preference: Optional[str] = None
    assigned_desk: Optional[str] = None

    class Config:
        from_attributes = True

class ChecklistTaskOut(BaseModel):
    id: UUID
    employee_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    skip_reason: Optional[str] = None
    blocked_by: Optional[UUID] = None
    dependencies: Optional[list[str]] = None

    class Config:
        from_attributes = True

class SkipRequest(BaseModel):
    skip_reason: str

class ScheduleBooking(BaseModel):
    date: date
    status: str

class SchedulerSubmit(BaseModel):
    bookings: list[ScheduleBooking]
    employee_id: Optional[UUID] = None

class ScheduleEntryOut(BaseModel):
    id: UUID
    employee_id: UUID
    date: date
    status: str
    employee_name: Optional[str] = None

    class Config:
        from_attributes = True

class BackupEmployeeInput(BaseModel):
    id: UUID
    name: str
    email: str
    slack_handle: str
    role: EmployeeRole
    department: str
    hire_date: date
    buddy_id: Optional[UUID] = None
    hybrid_preference: Optional[HybridPreference] = None
    assigned_desk: Optional[str] = None
    hashed_password: str

    _domain = field_validator("email")(_require_meridian_domain)

class BackupChecklistTaskInput(BaseModel):
    id: UUID
    employee_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    skip_reason: Optional[str] = None
    blocked_by: Optional[UUID] = None
    dependencies: Optional[list[str]] = None

class BackupScheduleEntryInput(BaseModel):
    id: UUID
    employee_id: UUID
    date: date
    status: str

class BackupPayload(BaseModel):
    version: str
    exported_at: str
    employees: list[BackupEmployeeInput]
    checklist_tasks: list[BackupChecklistTaskInput]
    schedule_entries: list[BackupScheduleEntryInput]

class QuestionCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)

class AnswerRequest(BaseModel):
    answer: str = Field(min_length=1)

class QuestionOut(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    subject: str
    body: str
    status: str
    answer: Optional[str] = None
    created_at: datetime
    answered_at: Optional[datetime] = None

    class Config:
        from_attributes = True



