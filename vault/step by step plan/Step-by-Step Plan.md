---
title: Step-by-Step Plan & Feature Debate
tags: [onboarding, frontend, planning, debate]
---

# 📋 Step-by-Step Plan & Feature Debate

This document acts as our collaborative space to review, debate, and track the development of the **Meridian Onboarding App** frontend. Below, we analyze our current features, compare them with the PDF specifications, identify critical gaps, and establish a clear implementation roadmap.

---

## 🔍 Feature-by-Feature Review & Debate

### 1. [[1. Onboarding Checklist|Onboarding Checklist & 30-60-90 Milestones]]
* **Status**: Implemented. A timeline showing tasks like contract signing, laptop configuration, buddy meeting, and security training. Uses vertical lines and status indicators.
* **The PDF Specification**: *"Make the first month at Meridian significantly less chaotic... checklist .md files are part of the deliverable."*
* **The Conflict/Gap**:
    * **Language Mismatch**: The Playwright test ([test_employee_flow.js](file:///D:/ForJobs/Qubiz/tests/test_employee_flow.js)) expects English buttons like `"Complete Task"` and `"Skip Task..."` and `"Reset Checklist"`. The current UI uses Romanian labels like `"BIFEAZĂ TASK"`, `"SĂRI TASK"`, and `"Reset Pathway"`. The test will fail immediately.
    * **Skip Logic Mismatch**: The test expects **three distinct skip flows** based on the task index/ID:
        1. **Task-2 (Laptop Config - Index 1)**: Inline Skip panel with text `"Inline Skip Action:"` and an input field with placeholder `"Specify reason for skipping..."` + `"Cancel"` & `"Confirm"` buttons.
        2. **Task-3 (Buddy Meeting - Index 2)**: Modal Skip overlay with header `"Skip Compliance Check"`, textarea with placeholder `"Provide skip justification statement here..."`, and a `"Submit Justification"` button.
        3. **Task-4 (Security Software - Index 3)**: Drawer Skip slide-out panel with header `"Skip Audit Flow"`, textarea with placeholder `"Explain why this step is bypassed..."`, and a `"Log Bypass & Flag HR"` button.
    * **Current UI**: Only has a single, basic text input for all skips, with no modals or drawers.
* **Debate**:
    > [!IMPORTANT]
    > **Decision**: We must refactor [OnboardingChecklist.tsx](file:///D:/ForJobs/Qubiz/src/features/onboarding/OnboardingChecklist.tsx) to implement these exact three skip variations (Inline, Modal, Drawer) and translate all buttons to English to make the Playwright test pass successfully.

---

### 2. [[2. Hybrid Scheduler|Hybrid Weekly Scheduler & Capacity Limits]]
* **Status**: Implemented. Mon-Fri calendar where employees click days to toggle between office (`🏢 BIROU`) and remote (`🏠 REMOTE`). Shows total office occupancy dynamically with a hard cap of 130 (to accommodate distribution of the 200 employees coming 3 days/week, accounting for mid-week peaks). Displays a warning if occupancy is $\ge 124$ (95% capacity). Shows co-presence check with the assigned Tech Buddy. Excludes any seating or desk maps.
* **The PDF Specification**: *"Hybrid work model: 3 days in office, 2 days remote. Departments... internal comms (Slack, Google Meet)..."*
* **Debate**:
    * *Enforcement*: The current scheduler allows selecting more than 3 office days. Should we programmatically enforce the "3-days-in-office" rule, or leave it as a user-controlled soft warning?
    * *Dynamic Occupancy*: Currently, base occupancy is calculated with a simulated static base (`40 - idx * 5`). To make the app feel premium, we should calculate total office occupancy dynamically by summing up all employees' schedules stored in our database.
    * *Integrations*: The Slack status synchronizer and Google Meet link generator are great mock implementations of internal tools.

---

### 3. [[3. Employee Directory|Employee Directory & Org Chart]]
* **Status**: Implemented. Virtualized list using `@tanstack/react-virtual` representing 200+ employees. Supports search and department filtering. The "Organizational Chart" tab renders a custom visual tree. Includes a dedicated **Onboarding Progress Dashboard** for HR (ADMIN) for real-time tracking of new hires, and follows a warm tone approach (welcoming UI, friendly phrasing, and welcome messages to reduce rigid compliance feel). It also has Slack message quick-copy templates (coffee, questions, intros).
* **The PDF Specification**: *"Meridian is a company of 200 employees... departments... you don't know anyone."*
* **Debate**:
    * Virtualization is critical for performance given the 200-employee count.
    * The Slack templates directly address the *"you don't know anyone"* paint point from the PDF, making communication friction-free.
    * The HR Admin panel allows adding a new hire, validating data (email ends with `@meridian.com`, Slack starts with `@`), and displays a live physical security badge mockup. This is a very high-quality addition that will impress the reviewers.

---

### 4. [[4. Database Backup|Database State & System Backup / Restore]]
* **Status**: Implemented. Store local state using IndexedDB (`localForage`). HR Admins can export system state to JSON and import it back. The importer validates schemas using `zod` and performs a "Ghost Buddy" audit (raising warnings if an imported employee points to a buddy ID not in the database).
* **The PDF Specification**: *"Any database of your choice... how you deal with ambiguity is important."*
* **Debate**:
    * Front-end only state persisted in IndexedDB is robust and simple to run.
    * The backup/restore schema validation and the Ghost Buddy audit show high engineering maturity, matching Qubiz's focus on enterprise-grade engineering.

---

### 5. [[5. Architecture and Deployment|Architecture & Deployment Decisions]]
* **Status**: Decided & documented.
* **The PDF Specification**: *"Recommended Technology Stack: .NET, React / Angular, Python, any database... Authentication is optional... README with clear instructions on how to run..."*
* **Debate**:
    * **SPA Architecture**: React + Vite + TypeScript with localForage (IndexedDB) for local data storage provides zero-dependency setup (no need for Docker/databases locally).
    * **Găzduire statică**: Aplicația este potrivită pentru Cloudflare Pages sau GitHub Pages.
    * **Auth Flow**: Pagina de login va avea butoane de "Quick Login" pentru testare ușoară și o pagină de "Signup/Înregistrare" care salvează profilul utilizatorului direct în IndexedDB.

---

## 📅 Step-by-Step Implementation Roadmap

We will divide the frontend refinements into the following sequential steps:

### 🟩 Step 1: Fix & Align Checklist UI with Playwright Test Suite
- Translate checklist buttons from Romanian (`BIFEAZĂ TASK`, `SĂRI TASK`) to English (`Complete Task`, `Skip Task...`, `Reset Checklist`).
- Implement the **Inline Skip** panel inside the card for Task-2.
- Implement the **Skip Compliance Check** modal for Task-3.
- Implement the **Skip Audit Flow** drawer for Task-4.
- Validate that the checklist transitions operate smoothly.

### 🟨 Step 2: Refine the Hybrid Scheduler & Occupancy Rule
- Calculate office occupancy dynamically based on all employees' schedules in IndexedDB.
- Add a soft validation checking if the user selects more than 3 office days per week.

### 🟦 Step 3: Polish Aesthetics & UI Polish (Swiss/Brutalist Style)
- Ensure fonts, spacing, margins, and borders align with the Qubiz brand identity defined in [design.md](file:///D:/ForJobs/Qubiz/design.md).
- Smooth out transitions (e.g. collapse/expand animations in the checklist).

### 🟪 Step 4: Implement Login, Signup, and Write Official Documentation
- Build the Quick Login panel and the Signup page in [LoginPage.tsx](file:///D:/ForJobs/Qubiz/src/features/auth/LoginPage.tsx).
- Create the official markdown files in the project root: `ASSUMPTIONS.md`, `DECISIONS.md`, and `WHAT_I_WOULD_DO_NEXT.md`, aligning them with vault decisions.

---

## 💬 Discussion & Review

> [!TIP]
> What are your thoughts on this roadmap? Let's proceed with **Step 1** to align the UI with the Playwright test code and ensure our core workflows are fully verified.
