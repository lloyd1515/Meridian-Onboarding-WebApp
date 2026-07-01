---
title: Interactive Manual Testing Guide
tags: [qa, testing, checklist, scheduler, manual]
---

# 🧪 Interactive Manual Testing Guide

This guide details all possible manual test cases, user interactions, and validation steps for the **Qubiz Meridian Onboarding Platform**. Open `http://localhost:5173/` in your browser and follow these step-by-step scenarios.

---

## 🔐 1. Authentication & Signup Flows

### Scenario 1.1: Quick Login Shortcuts (Pre-seeded DB check)
- **Goal**: Verify pre-seeded user loading from IndexedDB.
- **Steps**:
  1. Open `http://localhost:5173/#/login`.
  2. Under the credentials form, look at the **Default Simulator Logins** helper section.
  3. Click the button `jane.doe@meridian.com` (for Employee) or `vlad.hr@meridian.com` (for HR Admin).
  4. Verify that the email and password field auto-populate.
  5. Click **Authenticate**.
  6. **Expected Outcome**: You should successfully log in and redirect to the correct home screen (Admin Directory for Vlad, Employee Dashboard for Jane).

### Scenario 1.2: Signup Form Zod Validation (Client-side checks)
- **Goal**: Verify validation rules and Zod error formatting.
- **Steps**:
  1. Go to the login screen and click **Don't have an account? Sign Up**.
  2. Submit the form completely empty.
  3. **Expected Outcome**: A red alert banner should appear listing the validation failures:
     * *Name is required*
     * *Invalid email address*
     * *Email must end with @meridian.com*
     * *Slack handle is required*
     * *Slack handle must start with @*
  4. Enter an email not ending in `@meridian.com` (e.g. `bob@gmail.com`) and a Slack handle not starting with `@` (e.g. `bob_slack`). Click **Create Account**.
  5. **Expected Outcome**: Red warning details should persist.
  6. Fill in valid inputs:
     - **Name**: `Bob Jones`
     - **Email**: `bob.jones@meridian.com`
     - **Slack Handle**: `@bob.jones`
     - **Role**: `Fullstack Specialist`
     - **Department**: `Engineering`
     - **Hybrid Preference**: `HIBRID`
     - **Hire Date**: Pick a date 10 days in the future relative to the simulation date.
  7. Click **Create Account**.
  8. **Expected Outcome**: User is successfully saved to IndexedDB, signed in automatically, and redirected to the Employee Dashboard with a dynamic greeting: `"Welcome to Meridian, Bob Jones!"`.

---

## 📋 2. Onboarding Checklist View & Skip Cascade

### Scenario 2.1: Prerequisite Locking & Downstream Cascade
- **Goal**: Verify that dependent tasks cannot be completed until requirements are fulfilled.
- **Steps**:
  1. Log in as `jane.doe@meridian.com`.
  2. Click **Your brief** or navigate to `/checklist` from the sidebar/dashboard.
  3. Look at **Task 4** ("Install corporate security software").
  4. **Expected Outcome**: Task 4 must display a lock icon and the status `BLOCKED BY BUDDY` (because it requires Task 2 "Configure work laptop" and Task 3 "First meeting with Buddy" to be completed or skipped first). The action buttons for Task 4 should be completely hidden.
  5. Go to **Task 2** ("Configure work laptop").
  6. Click **Complete Task**.
  7. Look at **Task 4** status.
  8. **Expected Outcome**: Task 4 remains locked because Task 3 ("First meeting with Buddy") is still not completed or skipped.
  9. Click **Reset Checklist** (restart icon at the top right) to reset the checklist state.

### Scenario 2.2: Task 2 Inline Skip Action
- **Goal**: Verify the expanded inline skip input.
- **Steps**:
  1. Locate **Task 2** ("Configure work laptop").
  2. Click **Skip Task...**.
  3. **Expected Outcome**: An inline panel titled `INLINE SKIP ACTION:` appears inside Task 2's card. The text field placeholder `Specify reason for skipping...` must automatically focus.
  4. Click **Cancel**.
  5. **Expected Outcome**: The inline skip panel closes and no changes are made.
  6. Click **Skip Task...** again, input `Laptop bypass reason`, and click **Confirm**.
  7. **Expected Outcome**: Task 2 transitions to `SKIPPED TASK` status.

### Scenario 2.3: Task 3 Modal Compliance Skip
- **Goal**: Verify centered overlay backdrop compliance.
- **Steps**:
  1. Locate **Task 3** ("First meeting with Buddy").
  2. Click **Skip Task...**.
  3. **Expected Outcome**: A centered modal overlay with a semi-transparent blurred backdrop appears titled `Skip Compliance Check`. The input area `Provide skip justification statement here...` auto-focuses.
  4. Click the dark backdrop or the **Cancel**/**close** button.
  5. **Expected Outcome**: The modal closes.
  6. Click **Skip Task...** again, input `Buddy zoom coffee meet skipped`, and click **Submit Justification**.
  7. **Expected Outcome**: The modal disappears and Task 3 transitions to `SKIPPED TASK`. Task 4 ("Install corporate security software") is now unblocked and displays its action buttons.

### Scenario 2.4: Task 4 Drawer Skip Panel
- **Goal**: Verify right-sided slide-out drawer behavior.
- **Steps**:
  1. Locate the now-unblocked **Task 4** ("Install corporate security software").
  2. Click **Skip Task...**.
  3. **Expected Outcome**: A slide-out drawer transitions in from the right side of the viewport titled `Skip Audit Flow` with a dark backdrop overlay. The input `Explain why this step is bypassed...` auto-focuses.
  4. Click the backdrop or **Cancel**.
  5. **Expected Outcome**: The drawer slides back out and closes.
  6. Click **Skip Task...** again, input `Using secure dev sandbox`, and click **Log Bypass & Flag HR**.
  7. **Expected Outcome**: The drawer closes and Task 4 transitions to `SKIPPED TASK`.

---

## 📅 3. Team Hybrid Scheduler (HR Admin Workspace)

### Scenario 3.1: Daily Occupancy Counters
- **Goal**: Verify that columns display actual employee headcounts.
- **Steps**:
  1. Log in as HR Admin (`vlad.hr@meridian.com`).
  2. Navigate to **The practice** -> **Scheduler** or `http://localhost:5173/#/admin/scheduler`.
  3. Look at the column headers (MON, TUE, WED, THU, FRI).
  4. **Expected Outcome**: Each day shows `OCUPARE: X/130 LOCURI` representing the actual number of scheduled employees.
  5. Search for days displaying: `⚠️ ALERT: Capacity threshold reached. No more employees can be scheduled on this day.` (Monday and Thursday should show this because they are seeded above the 95% capacity alert threshold of 124 seats).

### Scenario 3.2: Strict 3-Day Weekly Office Limit Block
- **Goal**: Verify drag-and-drop limits preventing over-scheduling.
- **Steps**:
  1. Locate `Jane Doe` in the Monday column. She is already scheduled for Monday, Tuesday, and Thursday (3 office days).
  2. Click and drag her card to the Wednesday column.
  3. Release/drop the card.
  4. **Expected Outcome**: The drop must be blocked, the card must snap back to Monday, and a browser alert dialog must pop up: `"🔒 Strict limit reached: This employee is already scheduled for 3 office days this week."`

### Scenario 3.3: Office Capacity Hard Cap Block (130 Seats)
- **Goal**: Verify that no day can exceed 130 office occupants.
- **Steps**:
  1. Check a column close to the limit (e.g. Wednesday which has 120/130).
  2. Drag an employee who has remote days left (e.g. a remote hire from the directory list or remote day) and drop them into Wednesday.
  3. Repeat until the Wednesday counter reaches 130.
  4. Drag another employee and drop them into the full column.
  5. **Expected Outcome**: The drop must be blocked and display the browser alert: `"🔒 Capacity limit reached! The office cannot exceed 130 employees on any single day."`

---

## 🎨 4. Theme & Layout Customization

### Scenario 4.1: Color Themes (Contrast Compliance Check)
- **Goal**: Verify visual design states and WCAG AA compliance.
- **Steps**:
  1. Look at the top control bar containing **Theme: LIGHT, SLATE-DARK, OBSIDIAN-DARK, TEAL-DARK, STEEL-DARK, BRONZE-DARK**.
  2. Toggle **LIGHT** theme.
  3. Inspect the button colors and tags:
     * Completed steps/buttons must use compliantly dark Teal (`#0E8A9A`).
     * Alerts and recommendation warnings must use compliantly readable Burnt Orange (`#C65D00`).
  4. Toggle the dark themes. They should use vibrant cyan/orange accent colors that contrast highly on dark slates and obsidians.

### Scenario 4.2: Editorial Layout Styles
- **Goal**: Verify structural responsive layouts.
- **Steps**:
  1. Toggle **Style: SPLIT, CENTERED, EDITORIAL** in the top bar.
  2. **Expected Outcome**:
     * **SPLIT**: Large left visual pane with an interactive login form on the right.
     * **CENTERED**: Balanced form card centered directly in the screen.
     * **EDITORIAL**: Dynamic split grid layout highlighting brutalist lines and typography elements.
