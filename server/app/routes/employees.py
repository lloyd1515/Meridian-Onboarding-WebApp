from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, RoleChecker
from app.models import Employee
from app.schemas import EmployeeOut

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("/me", response_model=EmployeeOut)
async def get_me(current_user: Employee = Depends(get_current_user)):
    return current_user

@router.get("", response_model=List[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"]))
):
    stmt = select(Employee).order_by(Employee.name)
    result = await db.execute(stmt)
    employees = result.scalars().all()
    return employees
