from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import RoleChecker
from app.models import ChecklistTemplate
from app.schemas import ChecklistTemplateCreate, ChecklistTemplateOut, ChecklistTemplateUpdate

router = APIRouter(prefix="/checklist-templates", tags=["Checklist Templates"])

# Endpoint is restricted to hr_admin only
admin_dependency = Depends(RoleChecker(["hr_admin"]))


@router.get("", response_model=List[ChecklistTemplateOut], dependencies=[admin_dependency])
async def list_checklist_templates(db: AsyncSession = Depends(get_db)):
    stmt = select(ChecklistTemplate).order_by(ChecklistTemplate.department, ChecklistTemplate.sort_order)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ChecklistTemplateOut, status_code=status.HTTP_201_CREATED, dependencies=[admin_dependency])
async def create_checklist_template(payload: ChecklistTemplateCreate, db: AsyncSession = Depends(get_db)):
    template = ChecklistTemplate(**payload.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=ChecklistTemplateOut, dependencies=[admin_dependency])
async def update_checklist_template(template_id: UUID, payload: ChecklistTemplateUpdate, db: AsyncSession = Depends(get_db)):
    template = await db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist template not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[admin_dependency])
async def delete_checklist_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist template not found")

    await db.delete(template)
    await db.commit()
