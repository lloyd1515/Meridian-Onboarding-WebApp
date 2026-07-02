---
title: Meridian Onboarding Implementation Backlog
tags: [todo, planning, backlog, ParaInbox]
aliases: [Todo List, Backlog]
---

# 📋 Meridian Onboarding Implementation Backlog

This todo list compiles the remaining requirements, functional gaps, and code improvements identified during the audit of the Obsidian vault and the project codebase.

---

## 🔐 1. Authentication & Signup flows
- [ ] **Quick Login Dropdown**: Add a role-based login dropdown to [[LoginPage.tsx]] so testers can select standard test roles directly without typing:
  - **HR Admin**: `vlad.hr@meridian.com` (full directory access, backup export/restore, team scheduler)
  - **Buddy / Senior Software Engineer**: `alex.j@meridian.com` (view directory, modify own scheduler)
  - **New Hire / Preboardee**: `jane.doe@meridian.com` (restricted directory, onboarding checklist, scheduler limited to start week)
- [ ] **Pre-boarding Signup Gate**: Correct the `/auth/signup` flow in the backend and connect it to frontend forms. Currently, sign-ups call `POST /employees` which requires `hr_admin` permission. Implement a public `/auth/signup` route that checks a pre-boarding invite token and automatically hashes credentials and seeds the onboarding checklist.

## 🗓️ 2. Hybrid Scheduler Enhancements
- [ ] **Delayed Scheduler Validation ("Save" Button)**: Refactor [[HybridScheduler.tsx]] to prevent sending API calls immediately on every drop. Instead, allow the admin to drag/drop multiple cards and show an "Unsaved Changes" indicator.
- [ ] **Save Button Logic**: Add a "Save Changes" button that runs client-side/server-side validations:
  - Strict 3-day office limit per employee per week.
  - Daily capacity cap at 130 people.
  - Interactive warnings if occupancy exceeds 124 people.
- [ ] **Buddy Co-presence Checks**: Enforce co-presence logic in the scheduler and show warnings if a new hire has zero overlapping office days with their assigned buddy.

## 📋 3. Onboarding Checklist & Integrations
- [ ] **Richer Task Details**: Expand default checklist tasks in the database seed and [[OnboardingChecklist.tsx]] with complete markdown details, reference documentation, and specific subtasks.
- [ ] **Buddy Presentation**: Add a clear profile widget displaying the assigned Buddy's name, role, email, and Slack handle directly in the onboarding checklist dashboard.
- [ ] **Slack Template & Accessibility**: Enhance the copy-paste action on the Slack template. Ensure an `aria-live="polite"` element vocalizes success to screen readers and that template variables (buddy name, hire date) are interpolated.
- [ ] **Google Meet Links**: Include meeting templates and placeholder links for the buddy meeting task (`task-3`).

## 🏛️ 4. Documentation & Release Notes
- [ ] **ASSUMPTIONS.md**: Fill out user persona descriptions, data origin, and device contexts.
- [ ] **DECISIONS.md**: Document architectural boundaries, database integrity constraints, and reasonings for choosing Python (FastAPI) and PostgreSQL.
- [ ] **WHAT_I_WOULD_DO_NEXT.md**: Detail future roadmap phases (Priority 1, 2, 3 improvements).
