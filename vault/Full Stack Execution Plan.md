---
title: Full Stack Migration Blueprint
tags: [onboarding, backend, fastapi, postgresql, database, planning]
---

# 🚀 Full-Stack Migration Blueprint (FastAPI + PostgreSQL)

This document contains our target database schemas, REST API specs, and the complete microtask execution list detailing the exact subagent assignments.

---

## 🗄️ Database Schemas (PostgreSQL / SQLite Local)

### ER Diagram
```mermaid
erDiagram
    EMPLOYEES {
        uuid id PK "default: gen_random_uuid()"
        varchar name "NOT NULL"
        varchar email UNIQUE "NOT NULL"
        varchar slack_handle "NOT NULL"
        varchar role "NOT NULL"
        varchar department "NOT NULL"
        date hire_date "NOT NULL"
        uuid buddy_id FK "ON DELETE SET NULL"
        varchar hybrid_preference "NULL"
        varchar assigned_desk "NULL"
        varchar hashed_password "NOT NULL"
    }
    CHECKLIST_TASKS {
        uuid id PK "default: gen_random_uuid()"
        uuid employee_id FK "ON DELETE CASCADE, NOT NULL"
        varchar title "NOT NULL"
        text description "NULL"
        varchar status "NOT NULL, default: pending"
        text skip_reason "NULL"
        uuid blocked_by FK "ON DELETE SET NULL, NULL"
        json dependencies "NULL"
    }
    SCHEDULE_ENTRIES {
        uuid id PK "default: gen_random_uuid()"
        uuid employee_id FK "ON DELETE CASCADE, NOT NULL"
        date date "NOT NULL"
        varchar status "NOT NULL"
    }

    EMPLOYEES ||--o| EMPLOYEES : "has buddy"
    EMPLOYEES ||--o{ CHECKLIST_TASKS : "has tasks"
    EMPLOYEES ||--o{ SCHEDULE_ENTRIES : "has schedules"
    CHECKLIST_TASKS ||--o| CHECKLIST_TASKS : "blocked by"
```

### 📈 Database Integrity & Index Optimization Specs
1. **Primary Keys & UUID Generation**:
   - Database-side UUIDv4 generation required. Use `gen_random_uuid()` on PostgreSQL and string/TEXT representation of UUIDv4 on SQLite local.
2. **Indexes & Performance Tuning**:
   - `EMPLOYEES(buddy_id)`: B-Tree index to speed up buddy joins and directory queries.
   - `CHECKLIST_TASKS(employee_id)`: B-Tree index. Crucial for loading onboarding checklists quickly.
   - `CHECKLIST_TASKS(blocked_by)`: B-Tree index to optimize checklist dependency updates.
   - `SCHEDULE_ENTRIES(employee_id)`: B-Tree index for loading user-specific calendars.
   - `SCHEDULE_ENTRIES(date)`: B-Tree index to optimize workspace occupancy metrics queries.
3. **Data Integrity & Constraints**:
   - `SCHEDULE_ENTRIES` composite unique constraint: `UNIQUE (employee_id, date)`. Prevents duplicate bookings by the same employee on the same calendar day.
   - `EMPLOYEES` unique constraint: `UNIQUE (email)`. Enforce corporate email domain validation.
4. **Foreign Key Deletion Integrity (Orphan Prevention)**:
   - `EMPLOYEES.buddy_id`: `ON DELETE SET NULL`. If a buddy employee is deleted, the new hire's buddy is set to `NULL` (manual re-pairing required), preventing deletion of the new hire.
   - `CHECKLIST_TASKS.employee_id`: `ON DELETE CASCADE`. Deleting an employee automatically cleans up their tasks.
   - `CHECKLIST_TASKS.blocked_by`: `ON DELETE SET NULL`. Deleting a blocking task unblocks the dependent task.
   - `SCHEDULE_ENTRIES.employee_id`: `ON DELETE CASCADE`. Deleting an employee automatically removes their schedule.

## 🌐 API Route Specifications

| Method | Endpoint | Description | Auth Claim Requirement |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/signup` | Register a new hire profile. Requires a valid pre-boarding token in body. | Anonymous + Invite Token |
| **POST** | `/auth/login` | Authenticate credentials and return a signed JWT. | Anonymous |
| **GET** | `/employees` | Fetch paginated employees list with filter. Blocks pre-boarding users. | Authenticated (Active Employee) / Admin |
| **POST** | `/employees` | Create a new employee profile (HR Admin). | `role == 'hr_admin'` |
| **DELETE** | `/employees/{id}` | Remove employee + cascade delete all child state. | `role == 'hr_admin'` |
| **GET** | `/checklists/{empId}` | Load all onboarding tasks. Prevents IDOR/BOLA. | Own account / Admin |
| **PATCH** | `/checklists/{empId}/tasks/{taskId}/complete` | Mark a task as completed and unlock dependent steps. | Own account / Admin |
| **PATCH** | `/checklists/{empId}/tasks/{taskId}/skip` | Skip a task (with skipReason) and resolve deadlock. | Own account / Admin |
| **GET** | `/scheduler` | Get scheduled desk occupancy metrics. | Authenticated |
| **POST** | `/scheduler` | Set weekly schedule (Luni-Vineri). Enforces 3-day rule. | Own account / Admin |
| **POST** | `/backup/export` | Export entire database to a JSON file (HR Admin). | `role == 'hr_admin'` |
| **POST** | `/backup/restore` | Load and validate DB. Runs in single transaction with EXCLUSIVE lock. | `role == 'hr_admin'` |

### 🔒 Security, Hashing & Token Storage
1. **Password Hashing**:
   - Backend MUST use **Argon2id** (specifically `argon2-cffi` in Python) for password hashing. Do NOT use bcrypt or SHA-256. Argon2id provides superior resistance against GPU-based brute-force attacks.
2. **Token Storage**:
   - Save JWT access and refresh tokens in **HttpOnly, Secure, SameSite=Strict cookies**.
   - Do NOT store JWTs in `localStorage` or `sessionStorage` due to XSS vulnerabilities.
3. **Pre-boarding & Role Escalation Prevention**:
   - `/auth/signup` must validate a pre-boarding invite token generated by HR. Registration must fail if the token is invalid, expired, or doesn't match the pre-registered email.
   - Hires cannot specify their own role. Hires default to `'preboardee'` if their start date is in the future, or `'employee'` if it is in the past/present. Only HR admin (`role == 'hr_admin'`) can create/modify roles.
4. **Pre-boarding Route Protection & API Gates**:
   - Protect routes by evaluating the authenticated user's actual role and state, instead of relying on parsing the hash URL (e.g. `window.location.hash.includes('admin')`).
   - Limit `GET /employees` to active employees or HR admins, completely blocking pre-boarders to prevent unauthorized corporate directory scraping.

### ⚡ Race Conditions & Transaction Safety
1. **State Transition Safety (Checklist Tasks)**:
   - Mark task complete/skip API calls must run inside a database transaction block using `SELECT ... FOR UPDATE` (pessimistic locking) on the checklist task and its recursive dependents to prevent concurrent execution races.
2. **Scheduling Limits (3-Day Limit)**:
   - When saving scheduling choices, the backend must use a transaction with a pessimistic write lock on the employee's weekly bookings:
     ```sql
     SELECT id FROM schedule_entries WHERE employee_id = :empId AND date BETWEEN :startOfWeek AND :endOfWeek FOR UPDATE;
     ```
     This prevents a user from submitting concurrent schedule requests (e.g., in multiple browser tabs) that bypass the 3-day limit.
3. **Backup Restore Integrity**:
   - `/backup/restore` must run in a single atomic transaction. It must acquire an exclusive table-level lock (`LOCK TABLE employees, checklist_tasks, schedule_entries IN EXCLUSIVE MODE`) to prevent any concurrent database reads or writes during the truncate-and-load operation.

### 🔄 Zod & Pydantic Schema Synchronization
1. **Source of Truth**:
   - Backend Pydantic schemas (FastAPI) serve as the single source of truth.
2. **Auto-Generation Pipeline**:
   - Frontend TypeScript interfaces and Zod schemas must be generated automatically from the backend's `/openapi.json` using `openapi-typescript` + `ts-to-zod`.
   - Prevent manual schema duplication drift.

---

## 🗂️ Execution Task Board & Subagent Assignments

We will create **11 specialized subagents** to execute this migration sequentially.

### 🟥 Phase 1: Backend Database & Core API Setup
1. **Subagent `DBModelsDeveloper` (Task 1.1)**
   - **Goal**: Create SQLAlchemy 2.0 models with database-side UUIDv4 defaults (`gen_random_uuid()`). Establish foreign key constraints (`ON DELETE CASCADE` for checklist tasks/schedules, `ON DELETE SET NULL` for buddy/blocked_by relations). Add B-Tree indexes for `buddy_id`, `employee_id`, `blocked_by`, and `date`. Implement a composite unique constraint `UNIQUE (employee_id, date)` on `SCHEDULE_ENTRIES`. Setup Alembic migrations.
2. **Subagent `AuthBackendDeveloper` (Task 1.2)**
   - **Goal**: Write secure authentication routes for `/auth/signup` and `/auth/login`. Implement **Argon2id** password hashing (`argon2-cffi`). Write JWT utility to issue secure HttpOnly, Secure, SameSite=Strict cookies. Require and validate pre-boarding invitation tokens on signup.

### 🟨 Phase 2: Backend Business Services
3. **Subagent `ChecklistBackendDeveloper` (Task 2.1)**
   - **Goal**: Write checklist seed templates per department. Implement a state transition machine for task complete/skip flows running within database transactions using `SELECT ... FOR UPDATE` (pessimistic locking) to recursively resolve dependent tasks and avoid race conditions.
4. **Subagent `SchedulerBackendDeveloper` (Task 2.2)**
   - **Goal**: Build weekly scheduling routes. Implement occupancy calculations and hard validation rules for the 3-day office limit. Enforce transaction safety with pessimistic write locks (`SELECT ... FOR UPDATE`) on the employee's weekly schedule rows.
5. **Subagent `BackupBackendDeveloper` (Task 2.3)**
   - **Goal**: Implement JSON export and restore API endpoints. Ensure `/backup/restore` executes within a single database transaction and acquires exclusive table-level locks (`LOCK TABLE ... IN EXCLUSIVE MODE`) to prevent concurrent modifications.

### 🟩 Phase 3: Frontend API Bridge
6. **Subagent `APIClientDeveloper` (Task 3.1)**
   - **Goal**: Setup OpenAPI typescript code generation to auto-generate client types and Zod validation schemas from FastAPI's `/openapi.json`. Implement Axios client interceptors for cookie-based auth session management. Create TanStack Query hooks replacing localforage with structured query key invalidation strategies and optimistic updates for checklist toggle and scheduling.

### 🟦 Phase 4: Frontend UI Integration & Refinements
7. **Subagent `AuthUIUpdater` (Task 4.1)**
   - **Goal**: Connect LoginPage and SignupPage forms to backend `/auth` routes. Handle session context via JWT cookies. Enforce strict role-based client routing gates that prevent pre-boarders from accessing employee directories or admin routes, without relying on URL hash parsing.
8. **Subagent `ChecklistUIUpdater` (Task 4.2)**
   - **Goal**: Refactor `OnboardingChecklist.tsx` to display backend checklist tasks. Translate UI labels to English. Implement inline skip panels (Task 2), modal skip overlays (Task 3), and drawer skip panels (Task 4), linking their skip reasons to the backend PATCH endpoint.
9. **Subagent `SchedulerUIUpdater` (Task 4.3)**
   - **Goal**: Refactor `HybridScheduler.tsx` to handle backend-validated schedules. Display tech buddy co-presence indicators, enforce the 3-day office limit in UI, and show warning alerts when overall office occupancy $\ge 124$.

### 🟪 Phase 5: Visual Polish & Documentation
10. **Subagent `AestheticsSpecialist` (Task 5.1)**
    - **Goal**: Apply CSS variables and brutalist typography from `design.md` to index.css and feature component styling. Fix WCAG contrast anomalies across the entire app.
11. **Subagent `DocumentationArchitect` (Task 5.2)**
    - **Goal**: Write the official root files: `ASSUMPTIONS.md`, `DECISIONS.md`, and `WHAT_I_WOULD_DO_NEXT.md` describing full-stack decisions and future roadmap targets.
