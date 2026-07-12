# DECISIONS.md

What I built, what I deliberately didn't, and why.

## Product decisions

**Which features did I include?**

The test I applied to every feature: *does this replace something the "Welcome! See you on Monday." email failed to say, or does it remove work from the one HR person?* If neither, it didn't go in.

- **Onboarding checklist with dependencies** — the spine of the first month. Tasks are generated from department-aware templates, can block each other (you can't meet the team before you have a laptop), and unblock automatically as prerequisites complete. Skipping requires a reason so HR sees why, not just that, a task was bypassed.
- **Pre-boarding mode** — the direct answer to the brief's premise. An account whose start date is in the future gets the guide, a checklist preview, and Ask HR — and nothing else. The three-days-before-Monday window is where the real anxiety lives.
- **Company guide** — the unwritten-rules document, in the app instead of in a veteran's head: first-day logistics, tools, norms, people.
- **Hybrid scheduler** — the brief's 3-office-days/2-remote model made concrete: employees book office days against a 130-seat office with a 3-day/week cap; HR gets a drag-and-drop planning view.
- **Ask HR** — an async question inbox. New hires ask embarrassing questions privately; the single HR person answers them from one place instead of from six Slack threads.
- **HR admin** — onboarding-progress dashboard (30/60/90-day view across all hires), directory with org chart, Add New Hire form, CSV bulk import, JSON backup/restore.

**How did I prioritize?**

New hire's day-minus-3 to day-30 first, HR's workload second, everyone else last. When two features competed, the one visible to a nervous new hire on their phone the Sunday before day one won.

**What did I intentionally leave out?**

- **Real task due dates — said I'd defer this, then didn't.** I originally wrote in this doc that milestone buckets were derived from task *titles* (fragile, doesn't answer "what do I do today") and that I was deliberately not touching the schema two days before the deadline because a rushed migration is the one mistake that can take a demo down mid-review. Then, the next work session, I did it anyway: added `due_date`/`completed_at`/`milestone_offset_days` to `checklist_tasks`, wrote the migration with a real backfill, and drove the dashboard buckets off actual dates instead of string-matching titles. Nothing broke. In hindsight the honest version of the story isn't "I avoided the risky migration," it's "I deferred it under pressure, then did it carefully once I had a clearer head" — which is a better habit than the one I described at the time, but it means the earlier framing in this doc was wrong the moment I wrote it down.
- **Notifications (email/Slack push) — deliberately kept thin, not absent.** At 2–3 hires/month, HR opening the questions inbox daily beats maintaining a real notification pipeline, so I never built one. What I did ship, later, are narrow opt-in versions of the same idea: a manually-triggered Slack webhook send next to the existing "copy the intro message" button, a per-employee `.ics` calendar export, and a standalone script that emails a digest of open questions/overdue tasks (you have to run it yourself — it's not wired to a cron job). None of these are the maintained, automatic pipeline I said I was leaving out; they're cheap, manual versions of it that took an hour each and felt worth having.
- **Manager/org workflows** (approval chains, per-manager dashboards, lifecycle states). The brief describes one HR person at a 200-person company, not an enterprise HR platform. I took that seriously as a scope signal.
- **Documents/e-signing, and anything requiring a real third-party account (actual Slack app install, actual calendar-provider OAuth).** Each would dominate the remaining time on integration plumbing while demoing worse than what it replaced — a live OAuth flow in a take-home reviewer's browser is a demo risk, not a feature. What I did ship instead — a webhook-based Slack send and a downloadable `.ics` file — get most of the user-facing value without needing anyone's real account credentials. Those aren't "the integration," they're the part of the integration that doesn't require trusting a third party with a live login during a review.

## Technical decisions

**Why this database structure?**

Started as five tables, no cleverness: `employees`, `checklist_tasks`, `schedule_entries`, `questions`, `refresh_tokens`. It's grown since — `checklist_templates` (see below) and `audit_log` got added as real features needed them, so "five tables" is stale; it's seven-plus now, still no cleverness. Checklist tasks are *rows generated from templates*, not references to a shared template table — each hire's checklist is their own mutable copy (statuses, skip reasons, dependencies), which makes per-person progress trivial and template edits non-retroactive by design. Task dependencies are stored per-task and resolved server-side so completing a prerequisite unblocks dependents in one place. Postgres because it's boring and correct; Alembic migrations from the start so the schema has a history like the code does.

Templates themselves moved from a hardcoded Python dict (`checklist_templates.py`) to a real `checklist_templates` table with a CRUD API and an admin editor, so HR can change the onboarding process without a deploy. That move exposed a hack I'm not proud of: task-to-task dependencies were wired by *hardcoded array index* ("task at position 3 is blocked by the task at position 1"), which is exactly the kind of thing that silently breaks the moment someone reorders a template in the new editor. Fixed by giving `ChecklistTemplate` a real self-referential `blocked_by_template_id` column and a migration to backfill it. Found this one via a structured code review, not by hitting the bug myself — it's the kind of thing that looks fine until the one time someone actually uses the editor to reorder things, which is exactly what an editor is for.

**Why these libraries/frameworks?**

- **FastAPI + async SQLAlchemy**: the brief recommends Python; FastAPI gives typed request/response schemas (Pydantic) and free OpenAPI docs at `/docs`, which doubled as my API test console.
- **React + TypeScript + Vite** (brief-recommended), **Tailwind** for speed with a consistent look, **Zod** so the frontend validates against the same shapes the backend enforces.
- **Auth was "optional" — I built it properly anyway, and this was a deliberate bet.** The permission split (pre-boardee / employee / HR admin) is the product; auth is what makes it real. Since I was building it, I built it right: Argon2id password hashing, httpOnly + SameSite=Strict session cookies (no tokens in localStorage), CSRF double-submit protection, and refresh-token rotation with reuse detection — a stolen-and-replayed refresh token revokes the whole session family. That last piece is over-engineered for a take-home and I know it; it's the part of the backend I wanted to demonstrate I could do.
- **`db.ts` started as one file for everything and that was a mistake I let ride too long.** All frontend API calls — auth, employees, checklist, scheduler, backup, notifications, templates, questions, audit — lived in one 849-line file. It worked right up until I needed to change one corner of it and had to read the whole thing to be sure I wasn't breaking an unrelated corner. Split it into one file per domain (`services/db/employees.ts`, `services/db/checklist.ts`, etc.), kept `db.ts` itself as a plain re-export so nothing importing from it had to change. Should have done this the moment it hit maybe 300 lines instead of waiting for a review to point at it.

Known sharp edges, stated plainly rather than discovered by a reviewer:

- **Every new hire's account used to get created with an empty-string password.** The create-employee form had no password field (there was nothing for HR to type), so it silently sent `""`, the backend hashed it, and that hash is what a real login would have had to match. There's no invite or reset flow in this app, so this would have permanently locked out every single new hire created through the normal UI — the one workflow the entire brief is about. I never caught it because I only ever tested against seeded demo accounts. Fixed once a review flagged it: the server now generates a real random temporary password on creation and shows it to HR exactly once, and the update path no longer touches passwords at all. This is the bug I'm least proud of in this project, and the one I'm gladdest got caught before submission instead of by whoever tried the app first.
- **Rate limiting.** Configured but genuinely unenforced for a while — `RATE_LIMIT_*` settings sat in `config.py` with no middleware reading them, so login/signup had no brute-force protection. That's fixed now (`slowapi` as global middleware, a dedicated limiter for the scheduler since its legitimate traffic pattern is bursty), but I'm leaving the sentence in here as a reminder that "I put a config value there" and "I enforced it" are not the same claim, and I nearly shipped only the first one.
- **`POST /backup/restore` is a destructive replace** (truncate + reinsert). It's now gated behind a typed "RESTORE" confirmation phrase in the UI and every restore writes an audit-log row in the same transaction as the restore itself, so a partial failure can't leave you with a restored database and no record of who did it. Still a single-admin power tool, not something I'd want exposed to more than one trusted person — labeled as such on purpose, not because I ran out of time to lock it down further.
- **Admin employee-creation used to accept rich input** (id, role, password hash) on the theory that backup restore and CSV import legitimately need round-tripping. That's now split into two separate schemas: creating a new hire through the normal form takes none of that (no password field exists anymore, full stop), and only the backup-restore path — a different endpoint, gated the same as the rest of backup — still carries a password hash, because restore genuinely needs to put back what it read out. Narrower trust surface than the original one-size-fits-all endpoint, and I think the narrower version is just correct, not merely safer.

**If I had more time, what would I build differently?**

I'd start with the real backend from day one instead of the client-side mock I began with — the migration cost most of a day and left scars the git history documents honestly (`07743be`, `60bffbe`). And I'd introduce the template-driven checklist before writing any UI against hardcoded tasks, for the same reason.

## UX decisions

**Why this user flow?**

The new hire lands on a dashboard that answers three questions without a click: *where am I in onboarding* (day N, progress), *what needs doing* (reminders, open tasks), *what's next* (first-week agenda). Everything else is one nav-item deep. The checklist is one page with dependencies visualized rather than a wizard — a first month isn't linear, and a wizard lies that it is.

For HR, the flow is inverted: the dashboard is *across people* (every in-flight onboarding and its stuck points), because the HR person's daily question is "who needs me today?", not "how is Jane feeling?".

Role-based quick-login buttons on the login page are a demo-day decision: a reviewer should reach any of the three perspectives in one click, not hunt through seeded credentials.

**Did I test it with anyone? What changed after feedback?**

No second human — solo take-home on a deadline. The closest substitutes, honestly labeled as substitutes:

- **Playing each role end-to-end in the browser** after every feature landed, which caught real issues automated tests hadn't: employee/scheduler state not refreshing after login (`60bffbe`), the HR progress dashboard permanently showing zero (`5410759`), and a fabricated office-occupancy number on the dashboard that looked plausible and was pure fiction (`c74d347`) — that one I removed rather than fixed, on the principle that a wrong number is worse than no number.
- **Leftovers from the app's template origins** got flushed the same way: marketing-style nav pointing nowhere became the Company Guide (`8c53c4e`), and remaining Romanian UI strings were translated (`30dec51`).

What I'd do with a real user first: watch one actual new hire go from the welcome email to end-of-week-one, and reprioritize from that. The app encodes my guesses about first-day anxiety; one afternoon of observation would beat all of them.
