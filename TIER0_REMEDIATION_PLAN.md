# Meridian — Tier 0 fixes + first-day logistics

## Context

This follows a multi-pass architectural review of Meridian (an onboarding web app built for a hiring-challenge take-home): a self-written changelog/architecture doc, an independent "Fable" review (SOLID/GRASP scans + adversarial use-case review across two lenses, backend scan, stack-currency web search), and a re-evaluation of that review against the actual assignment brief. That process converged on a short list of confirmed-real correctness bugs ("Tier 0") that survive regardless of how the product is scoped, plus one piece of new scope — first-day logistics content and real task due dates — that the spec re-evaluation upgraded from "nice to have" to "close to the actual point of the assignment" (the brief's premise is that the only email a new hire gets is "Welcome! See you on Monday" — no real onboarding logistics ever arrive by any other channel, so the app has to carry that weight itself).

Everything else the review surfaced (org/manager hierarchy field, employee lifecycle status, task-ownership routing, department-management UI, a documents/forms system, Ask HR push notifications) was confirmed discretionary — the brief explicitly says "everything else about how the company operates is up to you" and describes a company that hires 2–3 people/month through one HR person, not a multi-hundred-person HR platform. None of that is in this plan.

A Plan agent independently re-verified every file and claim below against the current codebase (not just the review docs) and caught two things worth calling out up front: **Item 2 will break an existing test as written**, not just risk it (`test_checklist.py`'s `authenticated_newhire` fixture uses `role="preboardee"` and asserts 200 on complete/skip) — the fixture fix and a new regression test are part of Item 2, not a follow-up. And the capacity-constant unification (Item 1) touches more literal `130`/`124`/`3` occurrences than initially scoped — four more display/badge sites beyond the two enforcement branches.

---

## Item 1 — Unify the office capacity rule (130 cap / 124 warning / 3-day max)

**Bug:** three implementations currently disagree. `DashboardPage.tsx` blocks at `totalOccupancy >= 130` (max 129 fillable — wrong). `HybridScheduler.tsx` blocks at `> 130` (max 130 fillable — correct). Backend `scheduler.py` blocks at `count >= 130` where `count` excludes the requester (also effectively max 130 — correct), but warns at `count >= 124`, i.e. the warning doesn't fire until the total reaches 125, one off from both frontend copies.

**Fix — standardize on "total headcount including the person being added" everywhere:**
- New `src/constants/scheduling.ts`: `OFFICE_CAPACITY = 130`, `OFFICE_CAPACITY_WARNING = 124`, `MAX_OFFICE_DAYS_PER_WEEK = 3`. New directory (no existing `src/constants/` convention) — fine, matches `src/data/`/`src/services/` as a top-level concern folder.
- New backend `server/app/core/constants.py` mirroring the same three values (not `Settings`/`config.py` — that class is env-sourced deployment config; business constants don't belong there). One-line comment in each file pointing at its counterpart.
- `DashboardPage.tsx`: change cap check `>= 130` → `> 130`; import the constant at all 4 sites that currently hardcode `130`/`124`/`3` (cap check, warning check `line 232`, display string `line 253`, weekly-day-count check `line 67`).
- `HybridScheduler.tsx`: import the constant at all 4 sites (cap check `line 59`, warning badge `line 282`, display string `line 300`, weekly-day-count check `line 53`) — values unchanged, just de-hardcoded.
- `server/app/routes/scheduler.py`: change warning trigger from `count >= 124` to `count >= 123` (so it fires once total-after-add reaches 124, matching both frontends); import the new constants module instead of bare literals in the cap/warning/3-day checks.
- No `GET /scheduler/config` endpoint — single-tenant demo app, these are true constants not environment config; a fetch-on-boot endpoint adds a network dependency and a test surface for no behavioral gain at this scale.

**Verification:** extend `server/tests/e2e/test_scheduler.py` with a boundary test at exactly count=123/124 (warning crossover) and count=129/130 (reject crossover). Live-verify via chrome-devtools: drive `HybridScheduler.tsx` and `DashboardPage.tsx` to the boundary, confirm alert copy and crossover point match on both surfaces.

---

## Item 2 — Server-side role check on self-service scheduler/checklist actions

**Bug:** `POST /scheduler`'s `submit_schedules` only checks role when booking *on behalf of someone else*; a preboarding employee booking for themselves passes with zero check. `POST /checklists/{id}/complete` and `/skip` depend only on `get_current_user`, no role check at all — a preboarding employee can complete/skip their own onboarding tasks via direct API call weeks before their start date.

**Fix:**
- `server/app/routes/checklist.py`: in `complete_task` and `skip_task`, add `if get_effective_role(current_user) == "preboardee": raise HTTPException(403, ...)` right after resolving `current_user`, before the task lookup.
- `server/app/routes/scheduler.py`: in `submit_schedules`, add the same guard on the self-target branch (before the `payload.employee_id != current_user.id` admin-on-behalf-of branch reassigns `target_user`).
- Inline guards, not a shared `RoleChecker` dependency swap — these handlers need `current_user` resolved first for other logic (target resolution, admin-on-behalf-of branching in `submit_schedules`), so a bare dependency-level check would reject before that context exists or wouldn't compose with the dual self/admin-target path.

**Required alongside the fix (not optional):**
- `server/tests/e2e/test_checklist.py`: change `authenticated_newhire`'s fixture to a non-preboarding employee (`role="employee"`, past `hire_date`) for `test_checklist_workflows`, since that test's actual purpose is the recursive-unblock logic, not preboarding gating.
- Add `test_preboardee_cannot_complete_or_skip_tasks` (new preboardee fixture, asserts 403 on both endpoints) — the actual regression test proving the fix works.
- Add a companion scheduler test: preboardee self-booking via `POST /scheduler` gets 403.

**Verification:** the new tests above, plus live chrome-devtools check — log in as Jane Doe (preboardee) pre-fix (200) vs post-fix (403) on checklist complete.

---

## Item 3 — Fix `ProtectedRoute`'s hash-substring check

**Bug:** `App.tsx`'s `ProtectedRoute` does `if (isPreboarding && (window.location.hash.includes('admin') || window.location.hash.includes('directory')))` — string-matches the raw URL hash instead of route metadata, unlike the adjacent `requiresAdmin` prop pattern. Breaks on any future route merely containing "admin"/"directory" as a substring; doesn't declare intent.

**Fix:**
- Add a `restrictedDuringPreboarding?: boolean` prop to `ProtectedRoute`, same pattern as the existing `requiresAdmin` prop. Replace the hash-string check with checking this prop (still gated on the same `isPreboarding` boolean — verified this is computed from `hireDate` vs `simulationDate` in `AuthContext.tsx`, the same signal in use today, so no new client/server mismatch is introduced).
- Apply the prop to: `/admin/directory`, `/admin/scheduler`, `/admin/backup`, `/admin/questions` (already `requiresAdmin` too — belt-and-suspenders, matches current hash-match coverage) and `/directory` (the read-only directory route — confirmed it must stay covered: `DashboardPage.tsx`'s own preboarding copy says "Access to directory and admin settings is locked").
- Do **not** apply it to `/checklist`, `/guide`, `/ask-hr`, `/dashboard` — these are deliberately open during preboarding.

**Verification:** chrome-devtools nav to `/directory` and `/admin/directory` as a preboarding user (Jane Doe) — confirm redirect to `/dashboard`. Nav to `/checklist`/`/guide` as the same user — confirm no redirect.

---

## Item 4 — Literal/enum validation for `role` and `hybrid_preference`

**Bug:** `BackupEmployeeInput.role` and `hybrid_preference` fields are bare `str` with zero validation — a malformed direct-API payload (`POST /employees`, `POST /backup/restore`) could write a role value that matches no `RoleChecker` allow-list. (Verified: the app's own UI can't currently trigger this — every write path collapses through a 3-way ternary in `db.ts` — so the real exposure is a direct API caller bypassing the frontend, a legitimate defense-in-depth case, not the "malformed CSV" scenario originally suspected.)

**Fix:**
- Change `BackupEmployeeInput.role` (`server/app/schemas.py`) to `Literal['hr_admin', 'employee', 'preboardee', 'buddy']`. Confirmed full real value set by tracing every write site (seed script, signup, `mapEmployeeToBackend`) — `buddy` is real but currently unused by any `RoleChecker` allow-list and never actually persisted by the seed script; include it anyway since the frontend's existing "Senior Software Engineer" display round-trips to it and would otherwise start 422ing on a legitimate (if non-functional) path. Do not add `buddy` to any `RoleChecker` list as part of this fix — that's a separate, out-of-scope decision.
- Change `hybrid_preference` to `Literal['OFFICE', 'REMOTE', 'HYBRID']` everywhere it appears as bare `Optional[str]` (`SignupRequest`, `BackupEmployeeInput`).
- Leave a one-line comment at `db.ts`'s `mapEmployeeToBackend`/`validateAndRestoreBackup` role ternaries noting they lack a `preboardee` branch (a backup export→restore round-trip silently downgrades a preboarding employee to `employee`) — pre-existing, out of scope for this fix, but worth flagging since this change makes `"preboardee"` newly representable at the schema level.
- No DB-level CHECK/enum migration — Pydantic-level validation closes the actual reported hole without migration risk against existing seeded data.

**Verification:** new e2e tests posting an invalid `role`/`hybrid_preference` to `/employees` and `/backup/restore`, asserting 422.

---

## Item 5 — Enforce `@meridian.com` domain server-side

**Bug:** frontend zod requires `.endsWith("@meridian.com")`; backend `EmailStr` fields accept any valid domain.

**Fix:** add a Pydantic validator enforcing the `@meridian.com` suffix on `LoginRequest.email`, `SignupRequest.email`, and `BackupEmployeeInput.email` (`server/app/schemas.py`) — the three input schemas that accept an employee email. Apply uniformly including login (fails fast at the schema layer rather than falling through to a natural auth failure — minor difference in error shape, acceptable). All existing test fixtures already use `@meridian.com` — no expected breakage.

**Verification:** new e2e test posting a non-`@meridian.com` email to signup/login/employee-creation, asserting 422.

---

## Item 6 — Render `assigned_desk`

**Bug:** field is fully modeled end-to-end (DB column, schema, zod, both mappers) but rendered nowhere, despite the Company Guide promising it'll show on the Dashboard/Directory.

**Fix:**
- `DashboardPage.tsx`: add a small metadata line under the welcome header (near the existing "Day {n} of onboarding" caption style) showing `currentUser.assignedDesk`, with "Not yet assigned" fallback. No new data fetch needed — `AuthContext.tsx` already maps `assignedDesk` onto `currentUser`.
- `EmployeeDirectory.tsx`: append desk as a second line inside the existing "Buddy ID / Slack" cell in the virtualized row (matches the existing 2-line-stacked pattern already used there) rather than adding a 5th grid column.

**Verification:** chrome-devtools screenshot of Dashboard + Directory for Jane Doe (has a seeded desk value) confirming render, and for a user with `assigned_desk = null` confirming the fallback text.

---

## Item 7 — First-day logistics content (narrow addition, not a new section)

**Correction from initial scoping:** `companyGuide.ts` already has a `first-day` section with 5 entries (arrival, device, desk, dress code, pre-boarding access) from earlier work — this is partial coverage, not a 0%-present gap. The real remaining hole: building/badge access mechanics for day 2+ and parking — current content covers day-1 reception but nothing about getting in without an escort afterward.

**Fix:**
- Add 2-3 new entries to the existing `first-day` section in `companyGuide.ts` (same `GuideEntry` shape, department-agnostic) covering badge issuance and parking.
- No new dedicated Dashboard panel for this content (would duplicate the guide's content shape). Instead: a single small preboarding-only teaser card on `DashboardPage.tsx` (visible only when `isPreboarding && currentUser`), showing desk + arrival time pulled from `currentUser.assignedDesk` and the guide's existing `where-when` entry, linking out to `/guide`. Matches the existing preboarding-sparse-dashboard pattern rather than inlining full content twice.

**Verification:** chrome-devtools check of `/guide` and `/dashboard` as a preboarding user — confirm new entries render and the teaser card links correctly.

---

## Item 8 — Real task due dates (replaces title-based 30/60/90 classification)

**Bug:** `taskMilestoneDay(title)` in `db.ts` classifies tasks into 30/60/90-day buckets by matching against a hardcoded title set — fragile, silently wrong if a task title ever changes, and doesn't answer a new hire's actual question ("what must I do *today*?").

**Fix (migration-first — must land before any frontend work):**
1. New Alembic migration (`down_revision` = current head `959b067758e1`): add `due_date` (Date, nullable) and `completed_at` (DateTime, nullable) to `checklist_tasks`. No backfill in the migration itself.
2. `server/app/core/checklist_templates.py`: add `milestone_day: int` to `TaskTemplate`. Assign per-task: contract→1, laptop→1, buddy meeting→7, security software→7, security training→14, meet the team→21, capstone pair→60 and 90 respectively (splits what's currently one "90-day" bucket into two real milestones).
3. `seed_checklist_tasks()`: compute `due_date = employee.hire_date + timedelta(days=milestone_day)` at creation time.
4. **One-time backfill script** for existing seeded rows (not "acceptable to skip" — the flagship demo user, Jane Doe, would otherwise show blank due dates on ship day, and re-running the seed script is destructive against any data someone's interacted with). `UPDATE checklist_tasks SET due_date = ...` joined against a title→milestone_day lookup mirroring the template order.
5. `server/app/routes/checklist.py`: `complete_task`/`skip_task` set `completed_at = datetime.utcnow()` on the actual status-transition branch only (not on the existing early-return path for already-completed/skipped tasks — don't overwrite on a re-click).
6. Frontend: `Task` type/zod schema in `db.ts` gains `dueDate`/`completedAt`. Replace `taskMilestoneDay`'s consumers — confirmed only two: `DashboardPage.tsx` (`openTasksInMilestone`/`overdueMilestones`) and `OnboardingDashboard.tsx` (`tasks30`/`tasks60`/`tasks90` split) — with logic deriving the bucket from `dueDate` relative to `hireDate` instead of title matching. `OnboardingChecklist.tsx` currently shows no milestone/due-date info at all (doesn't call `taskMilestoneDay`) — add a real due-date render there as a new, low-risk addition in the same pass, directly answering the brief's "what must I do today?" framing.

**Verification:** `alembic upgrade head` against the existing seeded demo DB (not a fresh one) to confirm no failure on populated tables. Run the backfill, spot-check Jane Doe's `due_date` values against her `hire_date`. New e2e test asserting `complete_task` sets `completed_at`. Live chrome-devtools check of `OnboardingChecklist.tsx`'s new due-date render and `OnboardingDashboard.tsx`'s bucket percentages post-backfill.

---

## Sequencing

1. Item 1 (capacity constants) — independent, mechanical, do first.
2. Items 4 + 5 (schema validation) — group together, `schemas.py`-only + tests, no migration dependency.
3. Item 2 (role guard) — do alongside 4/5 (same route files); fixture fix + new tests are part of this commit, not a follow-up.
4. Item 3 (`ProtectedRoute`) — independent.
5. Item 6 (`assigned_desk` render) + Item 7 (guide content) — independent of the schema work, bundle together since both touch first-day-experience surface area.
6. Item 8 — last: migration → backfill → `completed_at` write → frontend `Task` schema → the two real consumers → new due-date render in `OnboardingChecklist.tsx`.

Each item lands as its own commit (matching this project's established one-logical-change-per-commit pattern), with `mcp__gitnexus__impact` run before editing existing symbols and `detect_changes` run before each commit, per this repo's `CLAUDE.md`. Live-verify each item in a real browser via chrome-devtools before considering it done, not just typecheck/test-green, matching how the rest of this project's remediation was verified.
