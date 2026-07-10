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

- **Real task due dates.** Today the 30/60/90-day buckets are derived by classifying tasks by title — it works for the seeded templates but it's fragile, and it doesn't answer "what must I do *today*?". The right design is already specced (a `due_date` column set from `hire_date + milestone offset` at task creation, a migration, and a backfill), but it's a schema migration two days before the deadline, and a rushed migration is the one category of change that can take the whole demo down. I chose to ship the honest limitation and the full design rather than a risky landing. It's Priority 1 in WHAT_I_WOULD_DO_NEXT.md.
- **Notifications (email/Slack push).** At 2–3 hires/month, HR opening the questions inbox daily beats maintaining an email pipeline. The inbox is the feature; push is polish.
- **Manager/org workflows** (approval chains, per-manager dashboards, lifecycle states). The brief describes one HR person at a 200-person company, not an enterprise HR platform. I took that seriously as a scope signal.
- **Documents/e-signing, calendar integration, real Slack integration.** Each is a third-party dependency that would dominate the remaining time while demoing worse than what it replaced.

## Technical decisions

**Why this database structure?**

Five tables, no cleverness: `employees`, `checklist_tasks`, `schedule_entries`, `questions`, `refresh_tokens`. Checklist tasks are *rows generated from templates*, not references to a shared template table — each hire's checklist is their own mutable copy (statuses, skip reasons, dependencies), which makes per-person progress trivial and template edits non-retroactive by design. Task dependencies are stored per-task and resolved server-side so completing a prerequisite unblocks dependents in one place. Postgres because it's boring and correct; Alembic migrations from the start so the schema has a history like the code does.

**Why these libraries/frameworks?**

- **FastAPI + async SQLAlchemy**: the brief recommends Python; FastAPI gives typed request/response schemas (Pydantic) and free OpenAPI docs at `/docs`, which doubled as my API test console.
- **React + TypeScript + Vite** (brief-recommended), **Tailwind** for speed with a consistent look, **Zod** so the frontend validates against the same shapes the backend enforces.
- **Auth was "optional" — I built it properly anyway, and this was a deliberate bet.** The permission split (pre-boardee / employee / HR admin) is the product; auth is what makes it real. Since I was building it, I built it right: Argon2id password hashing, httpOnly + SameSite=Strict session cookies (no tokens in localStorage), CSRF double-submit protection, and refresh-token rotation with reuse detection — a stolen-and-replayed refresh token revokes the whole session family. That last piece is over-engineered for a take-home and I know it; it's the part of the backend I wanted to demonstrate I could do.

Known sharp edges, stated plainly rather than discovered by a reviewer:

- **Rate limiting is configured but not enforced.** `RATE_LIMIT_*` settings exist in `config.py` from the security design pass, but no middleware consumes them — login/signup are not brute-force-protected. Wiring it is in WHAT_I_WOULD_DO_NEXT.md.
- **`POST /backup/restore` is a destructive replace** (truncate + reinsert), gated on the HR-admin role but with no audit trail or confirmation step beyond the UI's. Acceptable for a single-admin demo tool; labeled as such.
- **Admin employee-creation accepts rich input** (id, role, password hash) because backup restore and CSV import legitimately need round-tripping. That trusts the HR admin — consistent with the trust model in ASSUMPTIONS.md, but it's a decision, not an accident.

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
