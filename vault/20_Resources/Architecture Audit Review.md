---
title: Architecture Audit Review
tags: [security, audit, database, architecture]
---

# 🔍 Architecture Security & Integrity Audit Review

This document contains a brutally honest review of the migration plans, database schemas, and subagent allocations for the **Qubiz Meridian Onboarding** full-stack migration. Severe architectural vulnerabilities and design gaps were identified and corrected directly in the blueprint files.

---

## 🚨 Executive Summary of Critical Vulnerabilities

Prior to this audit, the [[Full Stack Execution Plan]] and [[subagent_architecture.canvas]] described a system vulnerable to data corruption, privilege escalation, credential theft, and database deadlocks. The proposed architecture has been upgraded to meet production-grade standards.

> [!WARNING]
> The initial plans lacked database-level uniqueness for schedule entries, used weak password hashing guidelines, stored JWTs insecurely, had an unsecured signup endpoint vulnerable to administrative privilege escalation, and did not account for concurrent transaction safety.

---

## 🛠️ Detailed Audit Findings & Corrective Actions

### 1. Security & Authentication Flow Audit
* **Vulnerability (Role Escalation / Privilege Hijacking)**: 
  - The `/auth/signup` endpoint was marked as `Anonymous` without verification. Anyone could hit this route, register an account, and inject `role: "hr_admin"`, hijacking the entire platform.
  - **Correction**: Reconfigured `/auth/signup` to require a cryptographically signed pre-boarding invitation token in the request header. Added backend checks to force registering users to `'preboardee'` or `'employee'` role based on start date. Only existing admins can escalate roles.
* **Vulnerability (XSS Token Theft)**:
  - Storing JWTs in React memory or local state (exposed to frontend JS) is vulnerable to XSS.
  - **Correction**: Mandated that the authentication service must set JWT access and refresh tokens in `HttpOnly`, `Secure`, and `SameSite=Strict` cookies.
* **Vulnerability (Outdated Hashing)**:
  - The plan specified generic "bcrypt" hashing. Bcrypt is vulnerable to modern GPU-based brute-forcing compared to memory-hard alternatives.
  - **Correction**: Upgraded specification to **Argon2id** (via `argon2-cffi` in Python), matching OWASP security recommendations.
* **Vulnerability (Brittle Route Protection)**:
  - Frontend route gates parsed the URL hash (`window.location.hash.includes('admin')`) to determine access. This is trivial to bypass.
  - **Correction**: Route protection was updated to rely strictly on the user's deserialized claims (`role`, `isPreboarding` status) within the React Context. Restricted `GET /employees` to active users to block pre-boarders.

### 2. Database Schema & Performance Audit
* **Vulnerability (Orphaned Records & Referential Integrity Failures)**:
  - The relationships lacked explicit referential action constraints. If a buddy employee was deleted, self-referencing foreign keys could crash the DB or delete the new hire.
  - **Correction**: Defined strict `ON DELETE` actions:
    - `EMPLOYEES.buddy_id`: `ON DELETE SET NULL` (keeps the employee, triggers re-pairing alert).
    - `CHECKLIST_TASKS.blocked_by`: `ON DELETE SET NULL` (automatically unblocks tasks if blocking task is deleted).
    - `CHECKLIST_TASKS.employee_id` and `SCHEDULE_ENTRIES.employee_id`: `ON DELETE CASCADE`.
* **Vulnerability (Missing Indexes)**:
  - No database indexes were defined for foreign keys. Join queries on `buddy_id`, `employee_id`, and `blocked_by` would require full table scans, resulting in severe performance degradation as the database scales.
  - **Correction**: Added B-Tree index specifications for `buddy_id`, `employee_id`, `blocked_by`, and `date`.
* **Vulnerability (Double Booking State Corruption)**:
  - Lack of a composite constraint on schedule entries allowed a user to make multiple reservations for the same day, corrupting office capacity metrics.
  - **Correction**: Added a composite unique constraint: `UNIQUE (employee_id, date)`.

### 3. Race Conditions & Transaction Safety
* **Vulnerability (Concurrent Checklist Tasks)**:
  - Recursive checklist task completion and skip unlocking could run concurrently, leading to dirty reads or deadlock conditions in state machines.
  - **Correction**: Implemented database-level pessimistic locks (`SELECT ... FOR UPDATE`) during status transitions.
* **Vulnerability (Scheduling Limit Bypasses)**:
  - A user could open multiple browser tabs and submit bookings concurrently, bypassing the 3-day office limit check (Read-Then-Write race condition).
  - **Correction**: Mandated that the schedule writing transaction lock the employee's weekly schedule rows with a write lock.
* **Vulnerability (Dirty Restore during Active Operations)**:
  - Running a JSON restore could truncate databases while write traffic is active, resulting in a partially restored, corrupted database.
  - **Correction**: Configured `/backup/restore` to execute in a single transaction with an exclusive table lock: `LOCK TABLE employees, checklist_tasks, schedule_entries IN EXCLUSIVE MODE`.

### 4. Frontend Integration & Schema Sync
* **Vulnerability (Validation Duplication & Drift)**:
  - Duplicating validation logic in Zod (frontend) and Pydantic (backend) guarantees validation drift and bugs.
  - **Correction**: Configured the React client generator pipeline to auto-generate typescript types and Zod schemas from the FastAPI `/openapi.json` schema using `openapi-typescript` and `ts-to-zod`.
* **Improvement (UI Responsiveness)**:
  - Enforced structured query keys (`['checklist', empId]`, `['scheduler', week]`) and optimistic updates in TanStack Query to keep the Brutalist UI feeling immediate and fluid.

---

## 🤖 Subagent Allocation Audit & Rectification

An analysis of [[subagent_architecture.canvas]] vs the [[Full Stack Execution Plan]] revealed a critical omission:
* **The Gap**: The `AestheticsSpecialist` (Task 5.1) was defined in the migration plan text but was completely absent from the Obsidian canvas visual mapping. This would cause visual style integration tasks to stall or be orphaned during autonomous team execution.
* **The Correction**:
  - Added a new node `cccccccccccccccc` representing `AestheticsSpecialist` to [[subagent_architecture.canvas]].
  - Connected Phase 4 UI Updaters to the `AestheticsSpecialist` node.
  - Routed the outputs of the `AestheticsSpecialist` node into `DocumentationArchitect` (Phase 5).

---

## 📌 Document References & File Links

Below are links to the modified files updated during this audit:
- **Migration Blueprint**: [Full Stack Execution Plan.md](file:///D:/ForJobs/Qubiz/vault/Full%20Stack%20Execution%20Plan.md) - Upgraded with exact indexing, transaction locks, and Argon2id specifications.
- **Subagent Canvas**: [subagent_architecture.canvas](file:///D:/ForJobs/Qubiz/vault/subagent_architecture.canvas) - Rectified with the missing `AestheticsSpecialist` subagent node and edges.
- **Welcome Index**: [Welcome.md](file:///D:/ForJobs/Qubiz/vault/Welcome.md) - Main directory entry.
