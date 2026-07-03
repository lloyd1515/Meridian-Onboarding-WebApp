import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_effective_role, RoleChecker
from app.models import Employee, Question
from app.schemas import QuestionCreate, QuestionOut, AnswerRequest

router = APIRouter(prefix="/questions", tags=["Questions"])

def _to_out(question: Question) -> QuestionOut:
    return QuestionOut(
        id=question.id,
        employee_id=question.employee_id,
        employee_name=question.employee.name if question.employee else None,
        subject=question.subject,
        body=question.body,
        status=question.status,
        answer=question.answer,
        created_at=question.created_at,
        answered_at=question.answered_at,
    )

@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    question = Question(
        employee_id=current_user.id,
        subject=payload.subject,
        body=payload.body,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question, attribute_names=["employee"])
    return _to_out(question)

@router.get("", response_model=List[QuestionOut])
async def list_questions(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Employees see only their own questions; HR admins see every question."""
    is_admin = get_effective_role(current_user) == "hr_admin"

    stmt = select(Question).options(selectinload(Question.employee)).order_by(Question.created_at.desc())
    if not is_admin:
        stmt = stmt.where(Question.employee_id == current_user.id)

    result = await db.execute(stmt)
    questions = result.scalars().all()
    return [_to_out(q) for q in questions]

@router.post("/{question_id}/answer", response_model=QuestionOut)
async def answer_question(
    question_id: UUID,
    payload: AnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(RoleChecker(["hr_admin"])),
):
    stmt = select(Question).options(selectinload(Question.employee)).where(Question.id == question_id)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    question.answer = payload.answer
    question.status = "answered"
    question.answered_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(question, attribute_names=["employee"])
    return _to_out(question)
