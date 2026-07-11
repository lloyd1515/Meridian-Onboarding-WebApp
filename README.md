# Meridian Onboarding

A web app that makes the first month at Meridian less chaotic — for the new hire *and* for the one-person HR team that has to onboard them.

Built for the Qubiz internship technical exercise. The companion docs required by the assignment live next to this file: [ASSUMPTIONS.md](./ASSUMPTIONS.md), [DECISIONS.md](./DECISIONS.md), [WHAT_I_WOULD_DO_NEXT.md](./WHAT_I_WOULD_DO_NEXT.md), [REFLECTION.md](./REFLECTION.md).

## Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, React Router, Zod
- **Backend:** FastAPI (Python 3.11), SQLAlchemy (async) + Alembic migrations
- **Database:** PostgreSQL 16
- **Auth:** cookie-based sessions — Argon2id password hashing, httpOnly + SameSite=Strict cookies, CSRF double-submit token, refresh-token rotation with reuse detection

## Run it locally (Docker — recommended)

Prerequisites: Docker with the Compose plugin. Nothing else — no local Node or Python needed.

```bash
cp .env.example .env        # placeholder values work fine for local use
docker compose up --build
```

That's it. The backend container runs Alembic migrations and seeds demo data automatically on startup (idempotent — safe to re-run).

| Service  | URL                          |
|----------|------------------------------|
| App      | http://localhost:5173        |
| API      | http://localhost:8090        |
| API docs | http://localhost:8090/docs   |
| Health   | http://localhost:8090/health/ready |

Stop everything with `docker compose down` (add `-v` to also drop the database volume and get a fresh seed next time).

## Demo accounts

All seeded accounts use the password `password123`. The login page also has a Quick Login selector for these three:

| Email                    | Role      | Sees                                                        |
|--------------------------|-----------|-------------------------------------------------------------|
| `jane.doe@meridian.com`  | New hire (pre-boarding) | The first-day experience: checklist, company guide, Ask HR |
| `alex.j@meridian.com`    | Employee (Jane's buddy) | The regular-employee view: dashboard, hybrid scheduler, directory |
| `vlad.hr@meridian.com`   | HR admin  | Everything above plus the HR side: onboarding progress dashboard, employee directory + org chart, hybrid scheduler admin, questions inbox, backup/restore + CSV import |

The seed also creates ~200 synthetic employees so the directory, org chart, and office-capacity logic behave like a real 200-person company.

## Run it bare-metal (optional)

If you'd rather run the frontend/backend outside Docker (only Postgres containerized), the `Makefile` wraps each step. Prerequisites: Node 20+, Python 3.11+, Docker for the database.

```bash
# one-time setup
python -m venv server/.venv && source server/.venv/bin/activate
pip install -r server/requirements.txt
npm install

make db-up migrate seed   # start Postgres, run migrations, seed demo data
make backend              # terminal A — FastAPI on :8090
make frontend             # terminal B — Vite dev server on :5173
```

Windows users: `make` isn't installed by default (`choco install make`, or use WSL) — or just use the Docker path above, which needs nothing else.

## Production deployment (partial)

`docker-compose.yml`'s `frontend` service runs the Vite dev server — fine for local dev, not for anything else. `docker-compose.prod.yml` is an override that swaps it for a production static build (`Dockerfile.prod`: multi-stage, non-root, serves the compiled `dist/` on :3000) without touching the dev service:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

This runs the prod-built frontend on host port 8080 (dev's `:5173` mapping is left alone, so both can run side by side) and widens the backend's `BACKEND_CORS_ORIGINS` to also accept that origin. `backend` and `db` are already prod-grade as-is (see `server/Dockerfile`) and are untouched by the override.

Secrets management (replacing `.env` with a real secrets manager) is intentionally out of scope here — see item 12 in [WHAT_I_WOULD_DO_NEXT.md](./WHAT_I_WOULD_DO_NEXT.md).

### Backup scheduling

`GET /backup/export` (hr_admin only, cookie-authenticated) returns the full JSON backup used by the HR admin restore flow. There's no built-in scheduler — the simplest viable setup is a cron job that logs in and curls the export to a timestamped file on a mounted volume:

```bash
#!/bin/sh
# backup.sh -- run periodically (e.g. via cron) against a running stack.
set -e
API_URL="${API_URL:-http://localhost:8090}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
COOKIE_JAR="$(mktemp)"

curl -sf -c "$COOKIE_JAR" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BACKUP_EMAIL\",\"password\":\"$BACKUP_PASSWORD\"}" -o /dev/null

mkdir -p "$BACKUP_DIR"
curl -sf -b "$COOKIE_JAR" "$API_URL/backup/export" \
  -o "$BACKUP_DIR/backup-$(date -u +%Y%m%dT%H%M%SZ).json"

rm -f "$COOKIE_JAR"
```

Point `BACKUP_EMAIL`/`BACKUP_PASSWORD` at a dedicated hr_admin service account (not a real person's login), mount `$BACKUP_DIR` to durable storage, and schedule it with either the host's crontab (`0 2 * * * BACKUP_EMAIL=... BACKUP_PASSWORD=... /path/to/backup.sh`) or a small sidecar service in `docker-compose.prod.yml` running `crond` alongside `curl`. This is a documented recipe, not a running service in this repo — add one only if the deployment actually needs unattended backups.

## Tests

```bash
npm test                                          # frontend unit tests (Vitest)
npx playwright test                               # frontend e2e (starts its own dev server; run `npx playwright install chromium` once first)
cd server && pip install -r requirements-dev.txt && pytest   # backend unit + e2e (runs against SQLite, no DB setup needed)
```

## What's in the app

- **Onboarding checklist** — department-aware task templates with dependencies (tasks unblock as prerequisites complete), skip-with-reason, buddy introduction with a copyable Slack template
- **Dashboard** — day-N-of-onboarding view, real reminders, 30/60/90-day progress, first-week agenda, office occupancy
- **Company guide** — the "everything nobody tells you" reference: first-day logistics, tools, people, norms
- **Hybrid scheduler** — book office days under the real constraints (130-seat office, max 3 office days/week), with an HR drag-and-drop admin view
- **Ask HR** — new hires submit questions, HR answers from an inbox
- **HR admin** — onboarding progress across all hires, employee directory with org chart, add-new-hire form, CSV bulk import, JSON backup/restore
- **Pre-boarding mode** — accounts whose hire date is in the future get a restricted view (checklist/guide/Ask HR available; directory and admin locked until day one)

## Repository layout

```
src/                # React frontend (feature-folder layout: auth, onboarding, hr-admin)
server/app/         # FastAPI backend (routes, models, schemas, core)
server/alembic/     # database migrations
server/scripts/     # seed script
server/tests/       # pytest unit + e2e suites
tests/              # Playwright e2e
CHANGELOG.md        # pre-git working log (see note at the top of that file)
```
