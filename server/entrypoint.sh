#!/bin/sh
# Entrypoint for the backend container.
#
# `docker compose up` previously started the API directly with bare uvicorn,
# which never creates the database schema (no migrations, no create_all in
# the app lifespan). This script makes `docker compose up` produce a working,
# seeded database every time:
#   1. Apply Alembic migrations to bring the schema up to date.
#   2. Run the seed script (idempotent — safe to run on every startup).
#   3. Hand off to uvicorn.
set -e

echo "[entrypoint] Running database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Seeding database (idempotent, safe to re-run)..."
python -m scripts.seed_data

echo "[entrypoint] Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
