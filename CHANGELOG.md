# 📝 Changelog & Commit Log

Deoarece utilitarul `git` nu este instalat sau adăugat în `%PATH%` pe sistemul gazdă, vom folosi acest fișier pentru a documenta și structura fiecare „commit” (modificare mică, izolată) pe care o efectuăm pe parcursul implementării.

---

## 📌 Commit Log

### [Commit 12] - Production E2E Agentic Pipeline v2.1, Subagent Swarm Hooks & GitHub Actions CI/CD
* **Fișiere create/modificate**:
  * [ci-agentic.yml](file:///D:/ForJobs/Qubiz/.github/workflows/ci-agentic.yml) - Creat workflow-ul GitHub Actions de producție pentru Node 22 LTS, Python 3.12, Vitest, Pytest, scanare de securitate Gitleaks și verificare Docker Compose.
  * [shared_context.jsonl](file:///D:/ForJobs/Qubiz/.omg/state/shared_context.jsonl) - Inițializat motorul de log-uri namespaced append-only pentru starea concurentă a agenților.
  * [run_agentic_pipeline.js](file:///D:/ForJobs/Qubiz/scripts/run_agentic_pipeline.js) & [subagent_swarm_orchestrator.js](file:///D:/ForJobs/Qubiz/scripts/subagent_swarm_orchestrator.js) - Implementat scriptul principal de execuție a pipeline-ului și orchestratorul de subagenți.
  * [production_agentic_pipeline_v2_1_blueprint.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/production_agentic_pipeline_v2_1_blueprint.md) & [brutally_honest_pipeline_synthesis.md](file:///D:/ForJobs/Qubiz/vault/01_Inbox/brutally_honest_pipeline_synthesis.md) - Salvat blueprint-ul master v2.1 și sinteza comparativă în Obsidian Vault.

### [Commit 11] - Hardened Slack Intro Clipboard & Security Control Token Sanitization
* **Fișiere modificate**:
  * [OnboardingChecklist.tsx](file:///D:/ForJobs/Qubiz/src/features/onboarding/OnboardingChecklist.tsx) - Adăugat tratament de eroare `async/try-catch` pe `handleCopySlackIntro`, igienizat caracterele de control și mentiunile Slack (`/[@<|>\x00-\x1F\x7F-\x9F]/g`) și implementat curățarea temporizatorilor `copyTimeoutRef` pentru eliminarea race condition-urilor.

### [Commit 10] - Buddy Profile Card, Google Meet Link & Accessible Slack Copy
* **Fișiere modificate**:
  * [OnboardingChecklist.tsx](file:///D:/ForJobs/Qubiz/src/features/onboarding/OnboardingChecklist.tsx) - Adăugat widget profil Buddy asignat în header-ul checklist-ului, link placeholder Google Meet (`meet.google.com/meridian-buddy-coffee`) pe Task 3 și suport de accesibilitate cu `aria-live="polite"` pentru copierea șablonului de introducere pe Slack.

### [Commit 9] - Delayed Hybrid Scheduler Batching & Buddy Co-presence Checks

* **Fișiere modificate**:
  * [HybridScheduler.tsx](file:///D:/ForJobs/Qubiz/src/features/hr-admin/HybridScheduler.tsx) - Adăugat sistem de stocare locală a modificărilor de scheduler (`isDirty`), butoane de „Save Changes” / „Discard”, validare de co-prezență Buddy cu notificări interactive și prevenire a apelurilor API excesive la fiecare operațiune drag-and-drop.

### [Commit 8] - Public Auth Signup & Quick Login Role Selector

* **Fișiere modificate**:
  * [schemas.py](file:///D:/ForJobs/Qubiz/server/app/schemas.py) - Adăugat `SignupRequest` Pydantic schema pentru înregistrarea publică.
  * [auth.py](file:///D:/ForJobs/Qubiz/server/app/routes/auth.py) - Implementat endpoint-ul `POST /auth/signup` cu seeding automat de task-uri checklist și atribuire rol preboardee/employee pe baza datei de hire.
  * [test_auth.py](file:///D:/ForJobs/Qubiz/server/tests/e2e/test_auth.py) - Adăugat testul end-to-end `test_signup_flow`.
  * [LoginPage.tsx](file:///D:/ForJobs/Qubiz/src/features/auth/LoginPage.tsx) - Adăugat selector rapid Quick Login (HR Admin, Buddy, Preboardee) și conectat formularul de signup la backend.

### [Commit 7] - Docker Security & DevOps Enhancements (Subagent 3 Review)

* **Fișiere create/modificate**:
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Integrarea recomandărilor Subagentului 3 (containere non-root, restart policies, .env variables interpolation, Cloudflare security headers, Railway pre-deploy configurations).
  * [Dockerfile](file:///D:/ForJobs/Qubiz/server/Dockerfile) - Actualizat pentru a rula sub `appuser` (non-root) și a utiliza BuildKit cache mounts.
  * [Dockerfile.dev](file:///D:/ForJobs/Qubiz/Dockerfile.dev) - Actualizat pentru a rula sub `node` (non-root).
  * [docker-compose.yml](file:///D:/ForJobs/Qubiz/docker-compose.yml) - Actualizat cu restart policies, interpolare de variabile `.env` și eliminarea parolelor plaintext.
  * [.env.example](file:///D:/ForJobs/Qubiz/.env.example), [.env](file:///D:/ForJobs/Qubiz/.env) - Configurații și credențiale locale.
  * [.gitignore](file:///D:/ForJobs/Qubiz/.gitignore) - Adăugat `.env` la fișierele ignorate.

### [Commit 6] - Database & Concurrency Hardening (Subagent 2 Review)
* **Fișiere modificate**:
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Integrarea recomandărilor Subagentului 2 (ACCESS EXCLUSIVE locks pentru restaurări, ordonare ascendentă a id-urilor pentru prevenirea deadlocks în SQLAlchemy async, optimizare indexare redundantă și instrucțiuni de configurare asincronă pentru Alembic/asyncpg).

### [Commit 5] - Hardened Security Specifications (Subagent 1 Review)
* **Fișiere modificate**:
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Integrarea recomandărilor Subagentului 1 (Argon2id DoS protection, CSRF headers, CORS strict policies, Refresh Token Rotation, class-based RBAC dependencies, rate limiting, stored XSS sanitization).

### [Commit 4] - Initial Docker Config
* **Fișiere create/modificate**:
  * [requirements.txt](file:///D:/ForJobs/Qubiz/server/requirements.txt) - Dependențe backend FastAPI (uvicorn, sqlalchemy, pydantic, asyncpg, argon2-cffi, pyjwt).
  * [Dockerfile](file:///D:/ForJobs/Qubiz/server/Dockerfile) - Build multi-stage optimizat pentru backend Python slim.
  * [Dockerfile.dev](file:///D:/ForJobs/Qubiz/Dockerfile.dev) - Imagine Node.js pentru rularea locală a frontend-ului React + Vite.
  * [docker-compose.yml](file:///D:/ForJobs/Qubiz/docker-compose.yml) - Definiția serviciilor de container (`db`, `backend`, `frontend`) și a volumelor persistente.

### [Commit 3] - Plan Iterația 3 Finalizat
* **Fișiere modificate**:
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Adăugarea detaliilor de containerizare, volume și strategii de deployment (Cloudflare, Railway, Neon).

### [Commit 2] - Plan Iterația 2 Finalizat
* **Fișiere modificate**:
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Definirea parametrilor de securitate Argon2id, cookie HttpOnly SameSite=Strict și pessimistic locks (`FOR UPDATE`).

### [Commit 1] - Schiță Plan de Migrare (MOC Reorganizat)
* **Fișiere create/modificate**:
  * [Welcome.md](file:///D:/ForJobs/Qubiz/vault/Welcome.md) - Reorganizare Obsidian Vault în PARA structure cu Mermaid knowledge graph.
  * [Docker & Backend Migration Plan.md](file:///D:/ForJobs/Qubiz/vault/10_Projects/Docker%20&%20Backend%20Migration%20Plan.md) - Iterația 1 (Schiță inițială).
