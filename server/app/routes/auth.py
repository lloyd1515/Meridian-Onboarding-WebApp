import secrets
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Response, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, create_refresh_token, verify_token
from app.models import Employee, RefreshToken
from app.schemas import LoginRequest, EmployeeOut
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

def set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf_token: str):
    is_prod = settings.ENVIRONMENT == "production"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/"
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/"
    )
    
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_prod,
        samesite="strict",
        path="/"
    )

    response.set_cookie(
        key="__Host-csrf_token",
        value=csrf_token,
        httponly=False,
        secure=is_prod,
        samesite="strict",
        path="/"
    )

@router.post("/login", response_model=EmployeeOut)
async def login(response: Response, credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Employee).where(Employee.email == credentials.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user.hashed_password, credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    access_token = create_access_token({"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.email})
    csrf_token = secrets.token_hex(32)
    
    db_refresh = RefreshToken(
        employee_id=user.id,
        token=refresh_token,
        used=False,
        expires_at=date.today() + timedelta(days=7)
    )
    db.add(db_refresh)
    await db.commit()
    
    set_auth_cookies(response, access_token, refresh_token, csrf_token)
    return user

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    ref_token = request.cookies.get("refresh_token")
    if not ref_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token"
        )
        
    payload = verify_token(ref_token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    email = payload["sub"]
    stmt = select(Employee).where(Employee.email == email)
    emp_result = await db.execute(stmt)
    user = emp_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
        
    stmt = select(RefreshToken).where(RefreshToken.token == ref_token).with_for_update()
    rt_result = await db.execute(stmt)
    db_token = rt_result.scalar_one_or_none()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
        
    if db_token.used:
        await db.execute(delete(RefreshToken).where(RefreshToken.employee_id == user.id))
        await db.commit()
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
        response.delete_cookie("csrf_token", path="/")
        response.delete_cookie("__Host-csrf_token", path="/")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token already used. Session compromised, all sessions revoked."
        )
        
    db_token.used = True
    
    new_access_token = create_access_token({"sub": user.email, "role": user.role})
    new_refresh_token = create_refresh_token({"sub": user.email})
    csrf_token = secrets.token_hex(32)
    
    new_db_refresh = RefreshToken(
        employee_id=user.id,
        token=new_refresh_token,
        used=False,
        expires_at=date.today() + timedelta(days=7)
    )
    db.add(new_db_refresh)
    await db.commit()
    
    set_auth_cookies(response, new_access_token, new_refresh_token, csrf_token)
    return {"status": "refreshed"}

@router.post("/logout")
async def logout(response: Response, current_user: Employee = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("csrf_token", path="/")
    response.delete_cookie("__Host-csrf_token", path="/")
    return {"status": "logged_out"}
