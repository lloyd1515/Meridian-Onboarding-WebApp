# REFLECTION.md

**What turned out to be harder than I expected?**

Two things, neither of them a feature.

First, *leaving the mock behind*. I started with a client-side data layer to move fast on UI, and it worked — too well. By the time role-based views existed, the mock had metastasized: a hardcoded password on every login, session logic in the browser that pretended to be security, and state that silently went stale after login. Migrating to the real FastAPI/Postgres backend wasn't hard because the backend was hard; it was hard because the mock had made a dozen small promises the real system refused to keep. The commit history from `07743be` through `60bffbe` is basically me paying that debt down in public.

Second, *"works on my machine" is a genuinely adversarial problem*. A fresh `npm install` was broken for anyone but me (a vite/plugin version conflict I never saw because my lockfile predated it), and the Docker frontend wrote root-owned files into the host's `node_modules`. Both were invisible until I deliberately played the role of a reviewer cloning the repo cold. That exercise — clone fresh, follow your own README, believe nothing — found more real bugs per hour than any other activity in the project.

**Which decision would I make differently if I started over?**

I'd build the walking skeleton first: one table, one endpoint, one page, deployed through Docker with migrations and seeding from commit one — then grow features inside it. Starting UI-first on a mock optimized for the first three days of the project at the cost of days five through ten. Relatedly, I'd set up git before writing any code; the Romanian pre-git log in CHANGELOG.md preserves that early history, but proper commits from the start would have been better evidence and better discipline.

The one decision I'd keep even though it looks like over-engineering: doing auth properly (Argon2id, httpOnly cookies, refresh rotation with reuse detection) in an "authentication is optional" assignment. The role split *was* the product, and building it right once was cheaper than faking it twice.

**What did I learn about myself as a developer?**

That my instinct under a deadline is to add, and the discipline I most needed was to subtract. The changes I'm proudest of are removals: deleting a fabricated office-occupancy statistic instead of "fixing" it, cutting dead dependencies and a no-op database stub, replacing a marketing template's fake navigation with one real page. And I learned where my personal line is on risk: with 48 hours left I had a fully-specced schema migration for real task due dates and chose to ship the documented limitation instead of the rushed migration. I think that was the right call. I'd rather defend a visible trade-off than debug an invisible one during a demo.
