# ==============================================================================
# Meridian Onboarding — developer entry points
#
# Bare-metal (Postgres in Docker, backend/frontend run locally):
#   1) make db-up migrate seed
#   2) make backend    (terminal A — serves on :8090, matching the frontend's
#                        default API base of http://127.0.0.1:8090)
#      make frontend   (terminal B — Vite dev server on :5173)
#
# Full Docker (no local Python/Node toolchain needed):
#   make up
#
# Windows note: `make` is not installed by default — get it via
#   choco install make
# or run everything inside WSL. If you'd rather not install `make` at all,
# the Docker path above (`docker compose up --build`) is the no-make
# fallback and needs nothing else installed.
# ==============================================================================

.PHONY: db-up migrate seed backend frontend up down

db-up:
	docker compose up -d db

migrate:
	cd server && alembic upgrade head

seed:
	cd server && python -m scripts.seed_data

backend:
	cd server && uvicorn app.main:app --reload --port 8090

frontend:
	npm run dev

up:
	docker compose up --build

down:
	docker compose down
