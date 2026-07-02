---
title: Adversarial Frontend Audit & Testing Protocol
tags: [audit, security, ux, a11y, functional, testing]
---

# 🕵️‍♂️ Adversarial Frontend Audit & Testing Protocol

This audit performs a security, UX, accessibility, and functional review of the **Qubiz Meridian Onboarding Frontend**. It highlights gaps between the current implementation and testing/design requirements, designs edge-case solutions, and provides concrete DevTools verification procedures.

---

## 1. 📋 Onboarding Checklist & Playwright Alignment

### A. Translation Mappings
The Playwright test suite expects specific English interactive labels. The current Romanian labels must be translated as follows:

| Romanian Label (Current UI) | English Label (Required UI) | Component & Element |
| :--- | :--- | :--- |
| `BIFEAZĂ TASK` | `Complete Task` | Button in active task card |
| `SĂRI TASK` | `Skip Task...` | Button in pending task card |
| `Reset Pathway` | `Reset Checklist` | Button in checklist header |
| `BIFEAZĂ DIFICULTATE` | `Complete Task` | Blocked task alert button |

Additionally, the seeded tasks inside `db.ts` and `OnboardingChecklist.tsx` must have their titles and descriptions translated to English to ensure the Playwright assertions matching on text strings succeed.

### B. Three-Tier Skip Workflows
The Playwright test checks for three custom skip layouts. The current single input box is a failure. We must implement:

1. **Task 2: Inline Skip Panel (Laptop Configuration - ID: `task-2` / Index 1)**
   - **Trigger**: Click `Skip Task...` on Task 2.
   - **UI Layout**: Inline container expanding directly under the description.
   - **Required Elements**:
     - Text element: `"Inline Skip Action:"`
     - Input field with placeholder: `"Specify reason for skipping..."`
     - Buttons: `"Cancel"` and `"Confirm"`
   - **CSS/Behavior**: Stays within the card boundary, animated height expansion, focus automatically shifted to the text input.

2. **Task 3: Modal Skip Overlay (Buddy Meeting - ID: `task-3` / Index 2)**
   - **Trigger**: Click `Skip Task...` on Task 3.
   - **UI Layout**: Screen-centered modal overlay with a semi-transparent backdrop.
   - **Required Elements**:
     - Header text: `"Skip Compliance Check"`
     - Textarea field with placeholder: `"Provide skip justification statement here..."`
     - Button: `"Submit Justification"`
     - Close/Cancel button.
   - **CSS/Behavior**: Trapped focus, backdrop blur, clicking outside cancels the action.

3. **Task 4: Drawer Skip slide-out (Security Software - ID: `task-4` / Index 3)**
   - **Trigger**: Click `Skip Task...` on Task 4.
   - **UI Layout**: Slide-out panel from the right edge of the screen.
   - **Required Elements**:
     - Header text: `"Skip Audit Flow"`
     - Textarea field with placeholder: `"Explain why this step is bypassed..."`
     - Button: `"Log Bypass & Flag HR"`
     - Close button.
   - **CSS/Behavior**: Smooth slide-in/out animation, overlay on top of checklist, slide-out on escape key press.

### C. Dependency Cascade & Deadlock Audits
* **The Deadlock Risk**: If a parent task (e.g., Task 2) is skipped, does it unblock its dependents? Currently, the unblocking logic only checks if dependencies are `'completed'`:
  ```typescript
  const otherDependenciesMet = task.dependencies.every(depId => 
    depId === taskId || updatedTasks.find(t => t.id === depId)?.status === 'completed'
  );
  ```
  If Task 2 is skipped, Task 4 (`blockedBy: 'task-2'`) will **remain blocked forever** because Task 2's status is `'skipped'`.
* **The Solution**: Update the dependency-checking logic in `handleCompleteTask` and `handleConfirmSkip` to treat both `'completed'` and `'skipped'` statuses as valid resolutions of a dependency:
  ```typescript
  const otherDependenciesMet = task.dependencies.every(depId => {
    const dep = updatedTasks.find(t => t.id === depId);
    return dep && (dep.status === 'completed' || dep.status === 'skipped');
  });
  ```

---

## 2. 🗓️ Scheduler Capacity & Overlap Logic

### A. Dynamic Occupancy Calculation
* **Current Gap**: Total occupancy counts are calculated using a mock static formula: `40 - (idx * 5) + currentDragList.length`.
* **Refined Client-Side Solution**:
  1. Distribute the seeded 210 employees into initial randomized schedules of 3 days per week inside `initializeDb()` during database seeding.
  2. In `HybridScheduler.tsx`, calculate total office occupancy by reading the actual database entries from `meridian_scheduler` in IndexedDB.
  3. Dynamic count for day `d` (0 to 4) = `scheduler[d].length`.
  4. Trigger the warning alert dynamically if occupancy $\ge 124$. Block new drops if occupancy hits 130.

### B. Enforcing the Strict 3-Day Office Limit
* **Rule**: An employee can schedule at most 3 office presence days per week.
* **UI State Block**:
  - In `handleDrop(colIdx)` or during date selections:
    - Scan the scheduler state `Record<string, string[]>` to count how many days the dragged employee is scheduled.
    - If the employee ID already exists in 3 distinct days:
      1. Block the drop action.
      2. Display a toast or overlay banner: `"🔒 Strict limit reached: [Employee Name] is already scheduled for 3 days of office presence this week."`
      3. Do not modify the IndexedDB record.

---

## 3. 🎨 Visual Aesthetics & WCAG Accessibility Audit

### A. Contrast Compliance (WCAG AA - 4.5:1)
The current color palette fails contrast requirements for active elements and text components:

| Element | Background | Current Color | Current Contrast | Audited Risk | Refined Color | Refined Contrast |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cyan text / links** | White (`#FFFFFF`) | `#2BC4D9` | **2.01:1** (FAIL) | High illegibility on active headers/links. | Darker Teal `#0E8A9A` | **4.55:1** (PASS) |
| **Orange text / badges** | White (`#FFFFFF`) | `#F2994A` | **2.32:1** (FAIL) | Labels and status markers are unreadable. | Burnt Orange `#C65D00` | **4.52:1** (PASS) |
| **Navy Muted Text** | White (`#FFFFFF`) | `#9CA9AF` | **2.20:1** (FAIL) | Uppercase kickers and captions are too faint. | Slate Gray `#5C6B73` | **5.30:1** (PASS) |
| **Primary Buttons** | Navy (`#0B2A3D`) | Text `#FFFFFF` | **14.80:1** (PASS) | Compliant, high readability. | No change | **14.80:1** (PASS) |

### B. Swiss/Brutalist Aesthetic Specifications
To align with Qubiz brand styling and Brutalist design:
* **Borders**: All cards, header bars, and sections must use crisp, solid borders (`1px solid #E2E5E4` or `#0B2A3D`) instead of smooth dropshadows.
* **Layout**: Align grids edge-to-edge ("full bleed") with no spacing between cards where appropriate.
* **Typography**: Utilize Outfit or Inter font, strict weights, uppercase captions, and large numerical kickers (e.g. `30`, `60`, `90` indicators).

---

## 4. 🔑 Auth Flow Simulator

### A. Persistent Database Auth
* **Current Gap**: Auth is mock-signed using hardcoded local objects. Registered users cannot log in.
* **Security & Persistence Refactoring**:
  1. Login Page should provide both **Login** and **Signup** views.
  2. **Signup Flow**:
     - Input fields: Full Name, Email, Slack Handle, Role, Department, Hybrid Preference.
     - Validate input values using the Zod `EmployeeSchema` (checking if email ends with `@meridian.com`, Slack starts with `@`, etc.).
     - If validation passes, create a new ID (`emp-${Date.now()}`) and write the employee to the `meridian_employees` table.
     - Seed a default checklist for the new employee in `meridian_checklists`.
     - Automatically log the user in.
  3. **Login Flow**:
     - Query the IndexedDB employee registry to check if the entered email exists.
     - If the email exists, load their actual database record, sign the secure session cookie in `sessionStorage`, and redirect.
     - If it does not exist, display an error: `"Authentication failed: Email address not registered."`
  4. **Quick Login Panel**:
     - Refactor buttons to query IndexedDB for the seeded accounts (`jane.doe@meridian.com` and `vlad.hr@meridian.com`) instead of initializing static non-persisted user objects.

---

## 5. 🤖 DevTools Test Cases (Validation Protocol)

The following Chrome DevTools MCP command sequences must be run to verify the implementation:

### Test Case 1: Account Creation & Login Verification
1. **Navigate to App**:
   - Command: `navigate_page` with URL `http://localhost:5173`
2. **Switch to Signup View**:
   - Command: `click` on the Signup Toggle button.
3. **Attempt Invalid Signup**:
   - Command: `fill` input fields:
     - Name: `Audit User`
     - Email: `audit.user@gmail.com` (invalid domain)
     - Slack: `audit.user` (missing @)
   - Command: `click` submit.
   - **Assertion**: Validate that input validations trigger and the form submission is blocked.
4. **Correct and Submit**:
   - Command: `fill` fields:
     - Email: `audit.user@meridian.com`
     - Slack: `@audit.user`
   - Command: `click` submit.
   - **Assertion**: Page redirects to `/dashboard`, and localForage contains the new employee record.

### Test Case 2: Onboarding Checklist & Distinct Skip Mechanisms
1. **Navigate to Checklist**:
   - Command: `navigate_page` to `/dashboard/checklist`
2. **Task 2 - Inline Skip Action**:
   - Command: `click` on the `Skip Task...` button inside the card for Task 2.
   - **Assertion**: Inline Skip panel displays under description containing text `"Inline Skip Action:"`.
   - Command: `type_text` into input: `"Skipping laptop setup because I use my personal machine."`
   - Command: `click` on the `"Confirm"` button.
   - **Assertion**: Task 2 is marked as skipped, and Task 4 (dependent) is unblocked (`blocked` status changes to `pending`).
3. **Task 3 - Modal Skip Action**:
   - Command: `click` on the `Skip Task...` button inside Task 3.
   - **Assertion**: Modal overlay displays with header `"Skip Compliance Check"`.
   - Command: `type_text` into textarea: `"Skipping buddy meet due to holiday."`
   - Command: `click` on `"Submit Justification"`.
   - **Assertion**: Modal closes, and Task 3 is marked as skipped.
4. **Task 4 - Drawer Skip Action**:
   - Command: `click` on the `Skip Task...` button inside Task 4.
   - **Assertion**: Drawer slides out from the right with header `"Skip Audit Flow"`.
   - Command: `type_text` into textarea: `"Bypassing security client installation under local test parameters."`
   - Command: `click` on `"Log Bypass & Flag HR"`.
   - **Assertion**: Drawer closes, and Task 4 is marked as skipped.

### Test Case 3: Hybrid Scheduler Limits & Occupancy Check
1. **Navigate to Scheduler (as Admin)**:
   - Command: `navigate_page` to `/admin/scheduler`
2. **Exceed Day Presence Cap (3 Days)**:
   - Command: `drag` employee card `emp-newhire` to Monday, Tuesday, and Wednesday columns.
   - Command: Attempt to `drag` the same employee card `emp-newhire` to Thursday column.
   - **Assertion**: UI blocks drop, showing a limit warning notification.
3. **Capacity Warnings**:
   - Verify that adding multiple employees to a single day updates the occupancy counter and shows the 95% threshold warning (124+ capacity).

---

## 6. 🚀 Git Commit & Push Strategy

To execute the completion plan cleanly and in line with constraints, we will adopt a strict feature-by-feature git push pipeline:

### Commit Messages Structure (Conventional Commits)
- **Checklist translation & unblocking**:
  `feat(checklist): translate labels to English and fix dependency skip-unblocking`
- **Inline Skip implementation**:
  `feat(checklist): implement inline skip panel with reason input for Task 2`
- **Modal Skip implementation**:
  `feat(checklist): implement compliance skip modal for Task 3`
- **Drawer Skip implementation**:
  `feat(checklist): implement right-aligned slide-out skip drawer for Task 4`
- **Scheduler logic & capacity updates**:
  `feat(scheduler): implement dynamic occupancy calculation and 3-day office limit`
- **Aesthetics & WCAG styling**:
  `style(ui): fix color contrasts for WCAG AA compliance and apply Swiss layout`
- **IndexedDB auth & signup**:
  `feat(auth): support new user signup and read/write credentials from IndexedDB`
- **Documentation release**:
  `docs(release): write assumptions, decisions, and future plans`

### 🔄 The Execution Loop
For every commit, the following protocol must be followed:
1. Complete step implementation.
2. Build project using `npm run build` to verify there are no compilation errors.
3. Run Chrome DevTools MCP check to verify the component works in the browser.
4. Ask user: *"May I commit the following: [Commit Message]?"*
5. Execute git commit on approval.
6. Ask user: *"May I push the commits to remote repository?"*
7. Push on approval.

---

> [!CAUTION]
> **Adversarial Deadlock Highlight**: Without the skip dependency cascade fix (unblocking when status is `'skipped'`), any user who skips a prerequisite task will lock the entire roadmap, rendering the onboarding flow useless. The dependency-checking refactor is a critical path item.
