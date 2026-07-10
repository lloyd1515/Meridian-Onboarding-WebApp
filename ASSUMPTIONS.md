# ASSUMPTIONS.md

What I assumed while building Meridian Onboarding, and why. Where an assumption turned out to be wrong mid-project, I say so — the brief asks for that explicitly.

## About the users

**Who uses the application?**

Three real roles, in order of how much I optimized for them:

1. **The new hire** — the person from the brief's premise. They got one email ("Welcome! See you on Monday.") and nothing else. They use the app twice: *before* day one (pre-boarding: what do I bring, where do I go, who is my buddy?) and *during* the first month (checklist, guide, asking HR the things they're embarrassed to ask in Slack).
2. **The HR person** — the brief says HR is a single person hiring 2–3 people per month. That shaped everything on the admin side: one dashboard showing all in-flight onboardings at a glance, a CSV bulk import so a hiring batch isn't three separate forms, and an Ask HR inbox instead of scattered Slack DMs. I assumed this person is competent but busy, not technical.
3. **The buddy** — an existing employee assigned to each new hire. They appear in the new hire's checklist (intro task, coffee chat) and in the directory. I assumed buddies don't need their own workflow — their job is to *be found*, not to operate the app.

Regular employees also touch the app for the hybrid scheduler (booking office days) and the directory, but they're not who it's for.

**What does the user already know when opening it the first time?**

Almost nothing — that's the premise. The new hire knows their own email address and start date, and roughly nothing else. So the app never assumes prior knowledge: the Company Guide covers the things nobody writes down (dress code, where to show up, what the first day actually looks like), and the dashboard says what "day 3 of onboarding" means concretely instead of assuming they know the plan.

I did assume the new hire can use a normal web app. There's no tutorial/tour — at 2–3 hires a month, a clean layout is cheaper and better than an onboarding flow *for the onboarding app*.

## About the data

**Who enters the information?**

- **HR** creates employee records — one at a time via the Add New Hire form, or in bulk via CSV import — and assigns department, buddy, and desk, and answers Ask HR questions.
- **The system** creates each new hire's checklist automatically from department-aware templates the moment the employee record is created. HR doesn't hand-author eight tasks per hire — at this hiring volume, that busywork is exactly what the app should remove.
- **The new hire** generates data by doing things: completing or skipping tasks (skips require a reason, so HR sees *why*), booking office days, submitting questions.
- **Seed data** stands in for "the company already exists": ~200 synthetic employees so the directory, org chart, and the 130-seat capacity rule behave realistically instead of being demoed against an empty database.

**When is the information added?**

Before the new hire's first day. The whole pre-boarding concept assumes HR creates the account when the offer is signed (start date in the future) — that's what flips the account into pre-boarding mode. An account created on or after the hire date just behaves as a regular onboarding.

**What happens if information is missing or incorrect?**

- Bad CSV rows → validated with Zod before anything is sent; the import log lists exactly which rows were rejected and why, instead of half-importing silently.
- A task that doesn't apply → skip-with-reason, so the checklist never dead-ends on "this doesn't apply to me and there's no button for that".
- Wrong or stale employee data → honest answer: there is no inline "edit employee" form yet. The recovery paths today are the JSON export → fix → restore round-trip, or re-import. That's a real gap and it's the first item in WHAT_I_WOULD_DO_NEXT.md's Priority 2.
- I assume HR-entered data is *trusted*. The admin endpoints accept fairly rich input because the backup/import features need them to. Defending against a malicious HR admin was out of scope; defending against a *confused* one (validation, import logs, idempotent seeding) was in. More on this trade-off in DECISIONS.md.

## About the context

**What device does the new employee use on the first day?**

Before day one: their **personal device**, possibly a phone. That's why this is a plain responsive web app behind a login — no VPN, no company laptop, nothing installed. On day one they receive a company laptop (it's literally a checklist task), and from then on I assume desktop-first usage; the HR views (drag-and-drop scheduler, dashboards) are unapologetically desktop-oriented.

**Do they have access before their first working day?**

Yes — this became the core product bet. If the only email says "see you on Monday", the app has to carry the logistics that the email didn't. But pre-boarding access is deliberately *restricted*: a pre-boarding account gets the checklist preview, company guide, and Ask HR, while the employee directory and anything admin-shaped stay locked until day one. Rationale: someone who hasn't started yet shouldn't be able to browse 200 colleagues' details, but absolutely should know where to show up and be able to ask questions.

## Assumptions that changed along the way

The brief says to document direction changes, so:

- **"A mock in-browser data layer will be enough" — wrong.** The project started client-side-only, including a login that quietly hardcoded every user's password to `password123`. Once role-based views existed, faking auth client-side was both insecure and *more* work than doing it properly, so I moved to a real FastAPI + Postgres backend with server-side sessions. The commit history shows the transition explicitly (e.g. `07743be fix(auth): stop hardcoding password123 on every login/signup`).
- **"One checklist fits everyone" — wrong.** An Engineering hire and a Sales hire share maybe half their tasks. The checklist became template-driven and department-aware (`d291394`), with one source of truth on the server instead of parallel frontend/backend task lists that drift apart.
- **"Authentication is optional" (per the brief) — I included it anyway.** The app holds personal data and has an HR-versus-employee permission split; role-based auth isn't decoration here, it's what makes pre-boarding mode and the HR area meaningful at all. Full reasoning in DECISIONS.md.
