import secrets
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Response, Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, verify_token
from app.models import Employee, RefreshToken, ChecklistTask
from app.schemas import LoginRequest, SignupRequest, EmployeeOut
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

@router.post("/signup", response_model=EmployeeOut)
async def signup(response: Response, payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Employee).where(Employee.email == payload.email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered"
        )

    # Role is always computed server-side and can never be supplied by the caller:
    # signup can only ever produce "employee" or "preboardee". Admins (hr_admin) and
    # other privileged roles are seeded/created by an existing admin, never via self-signup.
    assigned_role = "preboardee" if payload.hire_date > date.today() else "employee"

    hashed = hash_password(payload.password)
    user = Employee(
        name=payload.name,
        email=payload.email,
        slack_handle=payload.slack_handle,
        role=assigned_role,
        department=payload.department,
        hire_date=payload.hire_date,
        hybrid_preference=payload.hybrid_preference or "HIBRID",
        hashed_password=hashed,
    )
    db.add(user)
    await db.flush()

    # Seed default onboarding tasks
    tasks_data = [
        {"title": "Sign employment contract", "description": "Complete electronic signing of your contract and annexes in the portal.", "status": "completed", "deps": []},
        {"title": "Configure work laptop", "description": "Install operating system, VPN client, and core development tools.", "status": "in_progress", "deps": []},
        {"title": "First meeting with Buddy", "description": "Schedule a 30-minute Zoom or coffee meet to get to know each other.", "status": "pending", "deps": [1]},
        {"title": "Install corporate security software", "description": "Install the local security agent before accessing the internal network.", "status": "blocked", "deps": [1, 2]},
        {"title": "Information security training", "description": "Complete the mandatory interactive training on the HR platform.", "status": "pending", "deps": [0]},
        {"title": "Meet the team members", "description": "Schedule informal 1-on-1 chats with other engineers in your department.", "status": "pending", "deps": []},
        {"title": "Submit first Pull Request (PR)", "description": "Fix a small bug or implement a minor change in the main codebase.", "status": "pending", "deps": [1]},
        {"title": "Present a mini-demo", "description": "Showcase your completed project during the weekly engineering sync.", "status": "pending", "deps": [6]}
    ]

    created_tasks = []
    for td in tasks_data:
        task = ChecklistTask(
            employee_id=user.id,
            title=td["title"],
            description=td["description"],
            status=td["status"],
            dependencies=[]
        )
        db.add(task)
        await db.flush()
        created_tasks.append(task)

    # Link dependencies UUIDs
    for idx, td in enumerate(tasks_data):
        dep_indices = td["deps"]
        if dep_indices:
            dep_uuids = [str(created_tasks[d_idx].id) for d_idx in dep_indices]
            created_tasks[idx].dependencies = dep_uuids
            if idx == 3: # Install corporate security software blocked by laptop task
                created_tasks[idx].blocked_by = created_tasks[1].id

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
    # CSRF validation: refresh only depends on get_db, so the check performed by
    # get_current_user for other state-changing routes never runs here. Mirror it explicitly.
    csrf_cookie = request.cookies.get("__Host-csrf_token") or request.cookies.get("csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )

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
