# WHAT_I_WOULD_DO_NEXT.md

Two additional weeks, in the order I'd spend them.

A heads-up before the list: most of what I originally wrote in this file's Priority 1 and 2 sections already got built — real task due dates, inline employee editing, enforced rate limiting plus a proper backup audit trail, a buddy view, and HR-editable checklist templates backed by a real table. I'm not quietly deleting that history. The honest version of this doc is "here's what I said I'd do next, here's what actually happened, and here's what's *actually* still next now that that's done."

## Already done since I first wrote this list

- **Real task due dates.** Shipped the day after I first wrote this file, not two weeks later. Milestone buckets are computed from real `due_date`/`milestone_offset_days` columns now, not string-matched task titles.
- **Inline employee editing for HR.** Row-level edit drawer in the directory, `PATCH /employees/{id}`. No more export-fix-restore for a typo.
- **Rate limiting, enforced.** Global middleware, plus a separate looser limiter for the scheduler because its legitimate traffic is bursty.
- **Backup/restore audit trail + confirmation.** Typed "RESTORE" confirmation phrase, an audit log row written in the same transaction as the restore.
- **A buddy view.** Your mentees, their stuck tasks, one-click "schedule a coffee" via mailto.
- **HR-editable checklist templates.** Real table + CRUD API + admin editor, not a hardcoded Python dict.

None of these were "found by a reviewer" — I built them because they were the obviously correct next things once I had more than a first draft. What *was* found by a later structured review, and fixed as a result, gets its own honest writeup in DECISIONS.md: a critical empty-password bug on employee creation, an unsanitized Slack message in one of two near-identical send flows, a hardcoded-index hack in template dependencies, and a 849-line frontend file that needed splitting. That review pass is a big part of why this file needed rewriting at all — it's worth reading DECISIONS.md's "known sharp edges" section alongside this one.

## Priority 1 — Would fundamentally improve the experience

**1. Complete the first-day logistics loop.**
The guide covers day one (arrival, reception, device, dress code) but not day *two* — how do you get into the building without an escort? Badge issuance, parking, and a small pre-boarding dashboard card showing "your desk, your arrival time, your buddy" would close the exact gap the "See you on Monday" email creates. Content-heavy, code-light — still not done, still high value per hour, still the thing I'd do first.

**2. Watch one real user.**
Still true, still not done. Every prioritization decision in this file, including this list itself, is a hypothesis about what a new hire actually needs. Sitting one real person in front of the app from the welcome email through week one is the cheapest way to find out how wrong I am.

**3. Make Slack the buddy loop's actual default, not a button someone has to remember to click.**
There's a working webhook send and a copy-to-clipboard fallback, both manually triggered. What I actually wanted — ping the buddy automatically the moment their new hire completes the intro task — isn't built. Same story for the email digest: the script exists and works, but you have to run it by hand; it's not wired to a scheduler. Both are "the last 20% that makes it self-starting instead of another thing to remember."

## Priority 2 — Significant value

**4. A mobile-specific accessibility and UX pass.**
General accessibility got a real pass since I first wrote this file — keyboard navigation, focus management, ARIA labels, a Lighthouse-driven cleanup that got the main pages to a clean accessibility score. What that pass didn't cover is mobile viewports specifically: touch target sizes, the drag-and-drop scheduler's keyboard alternative on a small screen, whether the pre-boarding flow is actually pleasant on a phone. The pre-boarding user is plausibly on a phone (see ASSUMPTIONS.md) and that's exactly the path I haven't tested on one.

**5. Collapse the duplicated topological-sort logic.**
Both `checklist_tasks.blocked_by` ordering and `employees.buddy_id` ordering in the backup/restore path are near-identical hand-rolled implementations of the same graph problem (Kahn's algorithm), written at different times instead of sharing one generic helper. Nothing's broken by this — it's pure duplication, not a bug — but it's exactly the kind of thing that drifts out of sync the next time one of the two gets a bugfix and the other doesn't.

**6. Ops hardening for a real deployment.** Production docker-compose already exists (non-dev Vite build behind a static server). What's still just documentation, not automation: backup scheduling (there's a README recipe for a cron job, nobody's cron actually runs it), secrets from an actual secrets manager instead of `.env`, and structured log shipping. None of it changes the product; all of it is table stakes the moment a second person other than me depends on this running continuously.

## Priority 3 — Nice-to-have, and why they'd still matter

**7. Multi-select / bulk actions in the HR directory.** Right now every directory action is per-row. The one place this would visibly help is onboarding a batch of 2-3 hires who started the same week and need the same buddy-reassignment or department correction — a real pattern at this company's actual hiring cadence, just not one I hit often enough this month to prioritize.

**8. A lighter admin view for read-only stakeholders.** Right now it's HR-admin-or-nothing on the admin side. A manager who just wants to see "is my new report on track" doesn't need CSV import or backup/restore in their nav. Small, wouldn't touch the data model, just a narrower role.

**9. Notification preferences.** The Slack send and the email digest are both all-or-nothing today. Letting HR turn either off, or letting an employee opt out of Slack pings, is the kind of thing that matters exactly once someone complains and not a moment before — deliberately not solving a problem nobody's reported yet.
