from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import date
from typing import Optional

class LoginRequest(BaseModel):
    email: str
    password: str

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
    role: str
    department: str
    hire_date: date
    buddy_id: Optional[UUID] = None
    hybrid_preference: Optional[str] = None
    assigned_desk: Optional[str] = None
    hashed_password: str

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



