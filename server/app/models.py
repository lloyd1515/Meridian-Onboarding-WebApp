import uuid
import datetime
from sqlalchemy import Column, String, ForeignKey, Date, DateTime, JSON, UniqueConstraint, Index, UUID, Boolean, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    slack_handle = Column(String, nullable=False)
    role = Column(String, nullable=False, default="employee")
    department = Column(String, nullable=False)
    hire_date = Column(Date, nullable=False)
    buddy_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    hybrid_preference = Column(String, nullable=True)
    assigned_desk = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)

    # Relationships
    buddy = relationship("Employee", remote_side=[id], backref="buddies")
    tasks = relationship("ChecklistTask", back_populates="employee", cascade="all, delete-orphan")
    schedules = relationship("ScheduleEntry", back_populates="employee", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_employees_buddy_id", "buddy_id"),
    )

class ChecklistTask(Base):
    __tablename__ = "checklist_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    skip_reason = Column(String, nullable=True)
    blocked_by = Column(UUID(as_uuid=True), ForeignKey("checklist_tasks.id", ondelete="SET NULL"), nullable=True)
    dependencies = Column(JSON, nullable=True)
    # Real due-date tracking (replaces the frontend's title-matching 30/60/90
    # bucketing -- see checklist_templates.py's milestone_offset_days).
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    milestone_offset_days = Column(Integer, nullable=True)

    # Relationships
    employee = relationship("Employee", back_populates="tasks")
    blocked_by_task = relationship("ChecklistTask", remote_side=[id])

    __table_args__ = (
        Index("idx_checklist_tasks_employee_id", "employee_id"),
        Index("idx_checklist_tasks_blocked_by", "blocked_by"),
    )

class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # NULL/shared = applies to every department (formerly _CORE_TASKS);
    # a department name = capstone task for that department only
    # (formerly _DEPARTMENT_CAPSTONE).
    department = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    default_status = Column(String, nullable=False, default="pending")
    milestone_offset_days = Column(Integer, nullable=False)
    # Same index-based dependency scheme as the old hardcoded TaskTemplate
    # dicts: indices into the ordered template list for this department.
    dependency_indices = Column(JSON, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("idx_checklist_templates_department", "department"),
    )

class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)

    # Relationships
    employee = relationship("Employee", back_populates="schedules")

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_schedule_entries_employee_date"),
        Index("idx_schedule_entries_employee_id", "employee_id"),
        Index("idx_schedule_entries_date", "date"),
    )

class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String, nullable=False)
    body = Column(String, nullable=False)
    status = Column(String, nullable=False, default="open")
    answer = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)

    # Relationships
    employee = relationship("Employee")

    __table_args__ = (
        Index("idx_questions_employee_id", "employee_id"),
    )

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    expires_at = Column(Date, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)

    # Relationships
    actor = relationship("Employee")

    __table_args__ = (
        Index("idx_audit_log_created_at", "created_at"),
    )

