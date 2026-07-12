# REFLECTION.md

**What turned out to be harder than I expected?**

Two things, neither of them a feature.

First, *leaving the mock behind*. I started with a client-side data layer to move fast on UI, and it worked — too well. By the time role-based views existed, the mock had metastasized: a hardcoded password on every login, session logic in the browser that pretended to be security, and state that silently went stale after login. Migrating to the real FastAPI/Postgres backend wasn't hard because the backend was hard; it was hard because the mock had made a dozen small promises the real system refused to keep. The commit history from `07743be` through `60bffbe` is basically me paying that debt down in public.

Second, *"works on my machine" is a genuinely adversarial problem*. A fresh `npm install` was broken for anyone but me (a vite/plugin version conflict I never saw because my lockfile predated it), and the Docker frontend wrote root-owned files into the host's `node_modules`. Both were invisible until I deliberately played the role of a reviewer cloning the repo cold. That exercise — clone fresh, follow your own README, believe nothing — found more real bugs per hour than any other activity in the project.

**Which decision would I make differently if I started over?**

I'd build the walking skeleton first: one table, one endpoint, one page, deployed through Docker with migrations and seeding from commit one — then grow features inside it. Starting UI-first on a mock optimized for the first three days of the project at the cost of days five through ten. Relatedly, I'd set up git before writing any code; the Romanian pre-git log in CHANGELOG.md preserves that early history, but proper commits from the start would have been better evidence and better discipline.

The one decision I'd keep even though it looks like over-engineering: doing auth properly (Argon2id, httpOnly cookies, refresh rotation with reuse detection) in an "authentication is optional" assignment. The role split *was* the product, and building it right once was cheaper than faking it twice.

**What did I learn about myself as a developer?**

That my instinct under a deadline is to add, and the discipline I most needed was to subtract. The changes I'm proudest of are removals: deleting a fabricated office-occupancy statistic instead of "fixing" it, cutting dead dependencies and a no-op database stub, replacing a marketing template's fake navigation with one real page.

I also learned that my read on my own risk tolerance, in the moment, isn't reliable. With 48 hours left I wrote down — in this exact file, in an earlier draft — that I had a fully-specced migration for real task due dates and had decided not to risk it before the deadline, and that I thought that was the right call. Then, the very next session, I did the migration anyway. Nothing broke. So either the earlier decision was too cautious, or the later one was lucky — I genuinely don't know which, and I think pretending I do would be dishonest. What I'll actually commit to: the version of me with a clearer head a few hours later made a different call than the version of me staring at a countdown, and the clearer-headed version was right this time. I'd like to be that version more often, and I don't yet have a reliable way to get there except sleep.

**One more round I didn't originally plan for.**

I treated the first submission-ready state of this project as done, wrote these four docs, and then kept going — pointed a structured SOLID/GRASP/security review at my own code before turning it in. It found a real, ugly bug: newly created employee accounts were getting an empty-string password because the create form never sent one, with no invite or reset flow to recover from it, meaning every new hire I created through the actual UI would have been permanently locked out. I'd never hit it because I only ever tested with seeded accounts, never went through my own "create a brand-new person" flow start to finish. It also found a Slack message template that didn't sanitize employee names, a hardcoded-array-index hack in checklist dependencies waiting to break the moment someone used the editor I'd just built for exactly that purpose, and a 849-line frontend file I kept telling myself I'd split "later." All of it got fixed, tested, and is written up honestly in DECISIONS.md instead of buried.

The lesson isn't "always get a code review," which is obvious. It's narrower than that: I am bad at testing the exact path a real first-time user takes, because by the time I'm testing anything I'm never a first-time user of my own app anymore. Every account I log into already exists. The empty-password bug lived exactly in that blind spot — the one flow I structurally could not experience the way a reviewer would. I don't have a clean fix for this other than noticing it's a pattern and deliberately trying to be dumber about my own assumptions next time.
