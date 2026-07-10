# WHAT_I_WOULD_DO_NEXT.md

Two additional weeks, in the order I'd spend them.

## Priority 1 — Would fundamentally improve the experience

**1. Real task due dates (replace title-based 30/60/90 classification).**
The single change I most wanted to land and deliberately didn't (see DECISIONS.md). Today, milestone buckets are inferred from task *titles*; a new hire can't ask the app "what must I do today?" — which is the brief's actual question. The design is ready: add `due_date` and `completed_at` to `checklist_tasks` via an Alembic migration, give each task template a milestone offset (contract → day 1, buddy meeting → day 7, security training → day 14, …), compute `due_date = hire_date + offset` at seeding, backfill existing rows, then drive the dashboard buckets and an overdue indicator from real dates. It's roughly a day of careful work — the reason it isn't in this submission is that a schema migration was the one change I wasn't willing to rush 48 hours before the deadline.

**2. Complete the first-day logistics loop.**
The guide covers day one (arrival, reception, device, dress code) but not day *two* — how do you get into the building without an escort? Badge issuance, parking, and a small pre-boarding dashboard card showing "your desk, your arrival time, your buddy" would close the exact gap the "See you on Monday" email creates. Content-heavy, code-light — high value per hour.

**3. Watch one real user.**
Not a feature, but it would fundamentally improve the product: sit one actual new hire in front of the app from the welcome email through week one. Every prioritization below is a hypothesis; this is the cheapest way to falsify them.

## Priority 2 — Significant value

**4. Inline employee editing for HR.**
There's no "edit employee" form — fixing a typo in a desk assignment currently means the export → fix → restore round-trip. A row-level edit drawer in the directory is the obvious fix and the first thing a real HR user would ask for.

**5. Enforce the rate limiting that's already configured.**
`RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` exist in `config.py` but nothing consumes them — login and signup are not brute-force-protected. A small middleware (or `slowapi`) closes the gap the config already promises. I'd pair it with an audit trail and a typed-confirmation step on `POST /backup/restore`, which today is a destructive truncate-and-reinsert gated only by role.

**6. A buddy view.**
Buddies currently exist to be found. A minimal buddy page — "your new hire, their start date, their stuck tasks, one-click schedule-a-coffee" — would turn the buddy system from a directory entry into an actual mechanism, at maybe a day of work.

**7. HR-editable checklist templates.**
Task templates are code today (`checklist_templates.py`). Moving them to a table with a small admin editor lets HR evolve the onboarding process without a deploy — the correct end-state for a template-driven design, deliberately deferred because at 2–3 hires/month, editing code monthly is survivable and the editor is not demo-critical.

## Priority 3 — Nice-to-have, and why they'd still matter

**8. Calendar export (.ics) of the first-week agenda.** The new hire's real calendar is where their life lives; meeting them there beats asking them to check an app. Cheap, delightful, zero third-party dependency.

**9. Email digest for the HR inbox.** A daily "3 unanswered questions, 2 hires with overdue tasks" email. Kept out of Priority 1 deliberately: at this hiring volume an inbox habit works, but the digest removes the last way for a question to rot unseen.

**10. Accessibility and mobile pass.** The pre-boarding user is plausibly on a phone (ASSUMPTIONS.md); the new-hire pages are responsive but the app has had no systematic a11y audit (keyboard-only checklist navigation, focus management in the scheduler's drag-and-drop, contrast checks). Matters because day-minus-3 is exactly when someone is most likely to be anxious, on a phone, in a hurry.

**11. Real Slack integration.** The checklist's copyable Slack-intro template is a deliberate stand-in. Posting it via a webhook (and pinging buddies when their hire completes the intro task) makes the buddy loop self-starting — third-party surface area kept out of the take-home on purpose.

**12. Ops hardening for a real deployment.** Production docker-compose (non-dev Vite build behind a static server, secrets from a manager rather than `.env`), backup scheduling, and structured-log shipping. None of it changes the product; all of it is table stakes the moment a second company department depends on the app.
