from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, RoleChecker
from app.models import Employee
from app.schemas import EmployeeOut, BackupEmployeeInput
from app.core.security import hash_password
from app.core.checklist_templates import seed_checklist_tasks

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("/me", response_model=EmployeeOut)
async def get_me(current_user: Employee = Depends(get_current_user)):
    return current_user

@router.get("", response_model=List[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin", "employee"]))
):
    stmt = select(Employee).order_by(Employee.name)
    result = await db.execute(stmt)
    employees = result.scalars().all()
    return employees

@router.post("", response_model=EmployeeOut)
async def save_employee(
    emp_data: BackupEmployeeInput,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"]))
):
    stmt = select(Employee).where(Employee.id == emp_data.id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.name = emp_data.name
        existing.email = emp_data.email
        existing.slack_handle = emp_data.slack_handle
        existing.role = emp_data.role
        existing.department = emp_data.department
        existing.hire_date = emp_data.hire_date
        existing.buddy_id = emp_data.buddy_id
        existing.hybrid_preference = emp_data.hybrid_preference
        existing.assigned_desk = emp_data.assigned_desk
        if emp_data.hashed_password:
            existing.hashed_password = emp_data.hashed_password
    else:
        new_emp = Employee(
            id=emp_data.id,
            name=emp_data.name,
            email=emp_data.email,
            slack_handle=emp_data.slack_handle,
            role=emp_data.role,
            department=emp_data.department,
            hire_date=emp_data.hire_date,
            buddy_id=emp_data.buddy_id,
            hybrid_preference=emp_data.hybrid_preference,
            assigned_desk=emp_data.assigned_desk,
            hashed_password=emp_data.hashed_password if emp_data.hashed_password.startswith("$argon2id$") else hash_password(emp_data.hashed_password)
        )
        db.add(new_emp)
        await db.flush()
        # This is what makes HR's "Add New Hire" form produce a real,
        # persisted checklist instead of the client-side-only placeholder
        # it silently fell back to before.
        await seed_checklist_tasks(db, new_emp.id, new_emp.department)
    await db.commit()
    
    stmt = select(Employee).where(Employee.id == emp_data.id)
    result = await db.execute(stmt)
    return result.scalar_one()
