---
title: Docker & Backend Migration Plan
tags: [planning, backend, docker, deployment]
---

# 🗺️ Docker & Backend Migration Plan

Acest plan detaliază migrarea aplicației **Meridian Onboarding** la o arhitectură full-stack Docker. Conform cerințelor, planul va suferi 3 iterații de rafinare folosind sub-agenți specializați înainte de execuție.

---

## 🔄 Stadiul Iterațiilor Planului

- [x] **Iterația 1**: Schiță Inițială (Coordonator Core)
- [x] **Iterația 2**: Revizuire Arhitectură și Securitate (Sub-agent specializat)
- [x] **Iterația 3**: Revizuire Docker, Docker-Compose și Strategie Deployment (Sub-agent specializat)
- [x] **Iterația 4**: Reziliență Operațională & Developer Experience (Sub-agent specializat)

---

## 🛠️ Schiță Inițială (Iterația 1)

### 1. Servicii Target (Docker Compose)
* **`db`**: Instanță locală PostgreSQL 16 cu volum persistent.
* **`backend`**: Serviciu FastAPI (Python 3.11) rulat în container, cu auto-reload pe fișiere.
* **`frontend`**: Serviciu React + Vite rulat local în container, deservind portul 5173.

### 2. Structură Backend (`server/`)
* **Modele SQLAlchemy**: Angajați (Employees), Task-uri Checklist (ChecklistTasks), Programări (ScheduleEntries).
* **Autentificare**: JWT, parole hash-uite cu Argon2id.
* **Rute**: `/auth`, `/employees`, `/checklists`, `/scheduler`, `/backup`.

### 3. Integrare Frontend (`src/`)
* Înlocuirea `localForage` cu **TanStack Query (React Query)** apelând API-ul de backend.
* Integrare de interceptori pentru cookie-uri de sesiune.

---

## 🏗️ Recomandări Arhitectură & Securitate (Iterația 2)

În această etapă, s-au definitivat specificațiile tehnice pentru hashing-ul parolelor, securitatea sesiunilor și controlul concurenței la nivelul bazei de date, integrând feedback-ul de audit de securitate (OWASP & RFC 9106 standards).

### 1. Parametri Argon2id (Securitate Parole & Prevenire DoS)
Pentru hashing-ul parolelor în backend-ul FastAPI, se va utiliza biblioteca `argon2-cffi` cu parametrii recomandați de OWASP și RFC 9106:
* **Tip**: `Argon2id` (modul hibrid rezistent la atacuri side-channel și GPU-cracking).
* **Memory Cost ($m$)**: `65536` KiB (64 MiB).
* **Time Cost ($t$)**: `3` iterații.
* **Parallelism ($p$)**: `2` threads (redus de la 4 pentru a preveni epuizarea firelor de execuție și riscul de CPU-Denial of Service în mediile containerizate cu resurse limitate precum Railway free tier).
* **Salt & Hash**: `16` bytes salt generat via `os.urandom` și `32` bytes lungime hash.
* *Ajustare*: Se vor rula benchmark-uri locale pe infrastructura țintă pentru a asigura un timp de hashing între **100ms și 300ms** per verify, fără a monopoliza CPU-ul.

### 2. Securitate Sesiuni, Cookies și Anti-CSRF
Pentru a bloca atacurile de tip Cross-Site Scripting (XSS) și Cross-Site Request Forgery (CSRF):
* **Configurație Cookie JWT**:
  * `HttpOnly = True` (previne citirea token-urilor prin JavaScript, blocând furtul de sesiune via XSS).
  * `Secure = True` (cookie-urile se trimit doar prin HTTPS; opțiunea va fi dezactivată doar în local development).
  * `SameSite = Strict` (protejează împotriva trimiterii automate a cookie-urilor în cereri cross-site).
* **Double Submit Cookie Pattern (Anti-CSRF)**:
  * Pentru toate operațiunile care modifică starea (POST, PUT, PATCH, DELETE), clientul trebuie să trimită un antet HTTP `X-CSRF-Token`.
  * La autentificare, serverul setează un cookie adițional non-HttpOnly (`csrf_token`) cu o valoare aleatorie securizată. Clientul React citește acest cookie și îl atașează ca header. Backend-ul validează că header-ul se potrivește cu valoarea din cookie-ul clientului.
* **CORS Policy Hardening**:
  * Setarea explicită a `Access-Control-Allow-Origin` la originile de încredere (domeniul Cloudflare Pages în producție și `http://localhost:5173` local). Utilizarea wildcard-ului (`*`) este **strict interzisă** în combinație cu `Access-Control-Allow-Credentials: true`.
* **Refresh Token Rotation (RTR) & Detection**:
  * Access tokens cu durată mică (15 minute). Refresh tokens sunt de unică folosință și fac parte dintr-o structură arborescentă (token family).
  * La utilizarea unui refresh token, acesta este invalidat și se emite o pereche nouă.
  * **Detectarea Reutilizării**: Dacă se detectează prezentarea unui refresh token deja utilizat, serverul marchează întreaga familie de token-uri drept compromisă, revocă toate sesiunile active din acea familie și forțează o re-autentificare completă.

### 3. FastAPI Authorization (RBAC) & Pre-boarding Security Gates
* **Class-Based Dependency Injection**:
  * Autorizarea pe bază de roluri se va implementa prin clase Dependency Injectable (folosind `Depends`), evitând middleware-ul global rigid.
  * Decorator de endpoint: `dependencies=[Depends(RoleChecker(["hr_admin"]))]`.
* **Izolare Strictă Pre-boarding**:
  * Utilizatorii a căror dată de începere este în viitor (`hireDate > now()`) sunt marcați automat cu rolul `preboardee`.
  * Se aplică o politică strictă de whitelist: aceștia pot accesa doar propriul profil (`/employees/me`), propriul checklist de onboarding și programări din prima lor săptămână de lucru oficială. Orice alt endpoint (cum ar fi listarea directorului `/employees` sau exportul/importul de date) le va returna `403 Forbidden` pentru a preveni scurgerea de date.

### 4. Rate Limiting și Sanitizare Intrări
* **Limitare Rată (Rate Limiting)**:
  * Utilizarea `slowapi` pe endpoints critice pentru prevenirea brute-force:
    * `/auth/login`: Maximum 5 cereri pe minut per IP.
    * `/auth/refresh`: Maximum 10 cereri pe minut per IP.
* **Sanitizare Date (Stored XSS Prevention)**:
  * Utilizarea Pydantic validators în combinație cu `bleach` pentru a curăța intrările text din schemele de înregistrare (ex: nume angajat, descrieri task-uri) înainte de a fi stocate în baza de date.

### 5. Siguranța Tranzacțiilor și Lock-uri Pesimiste (Pessimistic Locking)
Pentru a evita race conditions în condiții de utilizare concurentă, se vor implementa tranzacții cu blocare pesimistă (pessimistic lock) la nivel de rând/tabel în PostgreSQL via SQLAlchemy async (`with_for_update()`):

* **Completare/Skip Checklist Tasks (Unlock Dependențe & Prevenire Deadlock)**:
  * Modificarea stării unui task și a dependențelor trebuie să execute un `SELECT ... FOR UPDATE` pe task-urile afectate, sortate ordonat pentru prevenirea blocajelor reciproce (deadlocks).
  * *Sintaxă SQLAlchemy*:
    ```python
    # ID-urile de task sunt sortate deterministic înainte de lock
    stmt = select(ChecklistTask).where(ChecklistTask.id.in_(sorted_task_ids)).order_by(ChecklistTask.id.asc()).with_for_update()
    await db.execute(stmt)
    ```
* **Săptămână de Lucru Hybrid (Validare Limite Birou)**:
  * Blocarea tuturor înregistrărilor din `SCHEDULE_ENTRIES` ale angajatului pentru săptămâna vizată, prevenind bypass-ul limitei prin cereri paralele.
  * *Sintaxă SQLAlchemy*:
    ```python
    stmt = select(ScheduleEntry).where(ScheduleEntry.employee_id == employee_id, ScheduleEntry.date >= start_date, ScheduleEntry.date <= end_date).with_for_update()
    await db.execute(stmt)
    ```
* **Restaurare Bază de Date (Import/Restore API)**:
  * Tranzacția de restaurare a bazei de date **trebuie** să ceară un lock exclusiv în mod `ACCESS EXCLUSIVE` pe tabele. Acest lucru blochează orice citiri (`SELECT`) sau modificări concurente în timp ce tabelele sunt golite (`TRUNCATE`) și repopulate, prevenind vizualizarea de date inconsistente și erorile de deadlock la escaladarea lock-ului.
  * *Sintaxă SQL*: `LOCK TABLE employees, checklist_tasks, schedule_entries IN ACCESS EXCLUSIVE MODE;`

### 6. Optimizări Indexare și Migrații (Alembic)
* **Eliminarea Indexului Redundant**:
  * Un index simplu pe `SCHEDULE_ENTRIES(employee_id)` este redundant deoarece constrângerea de unicitate composite `UNIQUE (employee_id, date)` creează automat un index composite B-Tree în care `employee_id` este prima coloană. PostgreSQL va folosi acest composite index pentru căutările bazate doar pe `employee_id`, reducând overhead-ul la scriere.
  * Se va păstra doar indexul pe `SCHEDULE_ENTRIES(date)` pentru calcularea metricilor generale de ocupare.
* **Configurare Asincronă Alembic**:
  * Fișierul `alembic/env.py` va fi configurat folosind template-ul asincron al Alembic (`alembic init -t async`), utilizând `run_sync` pentru migrații online și `poolclass=pool.NullPool` la configurarea engine-ului pentru a nu lăsa conexiuni deschise în fundal.

---

> [!NOTE]
> Acest plan a finalizat **Iterația 3**. Specificațiile de containerizare și configurare au fost definitivate și integrate.

---

## 🐳 Specificații Docker & Strategie Deployment (Iterația 3)

În această etapă s-au definitivat specificațiile pentru containerizarea aplicației, orchestrarea serviciilor pentru dezvoltare locală și pipeline-ul de deployment în producție, urmând standardele de securitate (OWASP Container Security) și reziliență DevOps.

### 1. Specificații Containerizare Securizate (Dockerfiles)

#### A. Backend (FastAPI - `server/Dockerfile`)
Se folosește o strategie de build multi-stage pentru a asigura o imagine finală minimă, optimizând cache-ul BuildKit pentru `apt` și `pip` și rulând aplicația ca utilizator non-root (`appuser` cu UID/GID 10001):
```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Final runtime
FROM python:3.11-slim AS runner

RUN groupadd --system -g 10001 appgroup && \
    useradd --system --uid 10001 --gid appgroup --create-home appuser

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    libpq5

COPY --from=builder --chown=appuser:appgroup /opt/venv /opt/venv
COPY --chown=appuser:appgroup . .

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### B. Frontend (React + Vite - `Dockerfile.dev`)
Pentru dezvoltare locală, rulăm aplicația ca utilizator neprivilegiat `node` (UID 1000) pre-existent în imaginea oficială node-slim:
```dockerfile
FROM node:20-slim

WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node package*.json ./
RUN npm install

COPY --chown=node:node . .

EXPOSE 5173
USER node

CMD ["npm", "run", "dev", "--", "--host"]
```

---

### 2. Orchestrare Servicii Securizată (Docker Compose)
Fișierul `docker-compose.yml` citește variabilele de mediu din fișierul local `.env` (care este inclus în `.gitignore`), evitând stocarea credentialelor în cod. De asemenea, adaugă politici de repornire automată (`restart`) pentru reziliență:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: meridian_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - meridian_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: meridian_backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_ALGORITHM=HS256
      - ENVIRONMENT=development
    ports:
      - "8000:8000"
    volumes:
      - ./server:/app
    depends_on:
      db:
        condition: service_healthy
    networks:
      - meridian_network
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: meridian_frontend
    restart: on-failure:5
    environment:
      - VITE_API_URL=http://localhost:8000
      - CHOKIDAR_USEPOLLING=true
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - meridian_network

volumes:
  postgres_data:

networks:
  meridian_network:
    driver: bridge
```

---

### 3. Configurații Dezvoltare Locală (Hot-Reload & Volume)
* **Hot-Reload Backend**: Maparea volumului `./server:/app` și flag-ul `--reload` permit repornirea automată a uvicorn.
* **Hot-Reload Frontend**: Maparea volumului și variabila `CHOKIDAR_USEPOLLING=true` rezolvă problemele de urmărire de fișiere (inotify) pe Windows.
* **Persistența Bazei de Date**: Volumul numit `postgres_data` stochează fișierele db-ului local.

---

### 4. Strategie Deployment în Producție (Railway, Cloudflare & Neon)

#### A. Baza de Date: Neon.tech (Serverless PostgreSQL)
* Activare obligatorie a SSL (`sslmode=require`) în conexiunea backend-ului.

#### B. Backend: Railway.app (Pre-Deploy Pipeline)
* **Pre-Deploy Command (Railway Web Console)**: Se setează separat comanda `alembic upgrade head`. Aceasta se execută într-un container izolat înainte ca aplicația să fie pornită. Dacă migrația eșuează, deploy-ul se oprește automat, eliminând riscul ca mai multe replici să încerce migrarea concurent în start-up script.
* **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (portul este injectat dinamic de Railway).

#### C. Frontend: Cloudflare Pages (Headers de Securitate)
* Pe lângă fișierul `public/_redirects` (`/* /index.html 200`), se creează un fișier de configurare headers `public/_headers` pentru a întări securitatea producției:
```text
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-XSS-Protection: 1; mode=block
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://meridian-backend.up.railway.app http://localhost:8000; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval';
```
*(Nota: `unsafe-eval` este necesar temporar pentru evaluarea frontend în preview).*

---

> [!NOTE]
> Acest plan a finalizat **Iterația 4**. S-au adăugat specificații de reziliență operațională, strategie de testare, pipeline CI/CD și unelte DX.

---

## 🔍 Iterația 4 — Reziliență Operațională & Developer Experience

Această iterație abordează riscurile operaționale identificate în planul existent, adaugă o strategie completă de testare, pipeline CI/CD, și unelte de Developer Experience (DX) menite să reducă fricțiunea la setup și la debug.

> [!WARNING]
> **Riscuri identificate în planul curent (Iterațiile 1–3):**
>
> 1. **Zero health checks pe backend** — Docker Compose nu are `healthcheck` pe serviciul `backend`, deci `frontend` poate porni înainte ca API-ul să fie gata. Railway nu poate face zero-downtime deploys fără un endpoint de liveness.
> 2. **Nicio strategie de logging** — Fără logging structurat, debug-ul în producție se bazează pe `print()` și sperăm la ce e mai bun. Zero corelație între request-uri.
> 3. **Fără graceful shutdown** — Uvicorn primește `SIGTERM` la deploy/restart dar aplicația nu curăță conexiunile DB sau task-urile in-flight. Poate cauza tranzacții orfane și corupție date.
> 4. **Niciun test menționat** — Planul nu conține nicio referință la teste unitare, de integrare sau end-to-end. Fără teste, orice refactoring este un pariu.
> 5. **Fără CI/CD pipeline** — Codul ajunge în producție prin deploy manual fără niciun gate de calitate. Nicio verificare automată a linting-ului, type checking-ului sau testelor.
> 6. **Migrații Alembic fără rollback plan** — Dacă o migrație eșuează la jumătate pe Railway, nu există procedură de recuperare documentată.
> 7. **Backup/Restore fără validare** — Endpoint-ul `/backup` exportă date dar nu validează integritatea la import (FK-uri invalide, date corupte, format incompatibil).
> 8. **Env var management fragil** — Niciun `.env.example`, nicio validare la startup. Un `JWT_SECRET` lipsă = crash la prima cerere de auth, nu la boot.
> 9. **DX friction** — Nu există `Makefile`, nu există `scripts/`, setup-ul cere citirea întregului plan. Niciun shortcut pentru operații comune.
> 10. **Fără limite de resurse pe containere** — Containerele pot consuma toată memoria host-ului. Argon2id cu 64 MiB per hash + cereri concurente = OOM kill fără avertisment.

---

### 1. Health Check Endpoints & Readiness Probes

Se adaugă două endpoint-uri pe backend: un **liveness probe** (superficial) și un **readiness probe** (deep, cu verificare DB):

```python
# server/app/routes/health.py
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness():
    """Liveness probe — returnează 200 dacă procesul rulează.
    Folosit de Docker/Railway pentru a decide dacă containerul trebuie restartat."""
    return {"status": "alive"}


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness():
    """Readiness probe — verifică conexiunea la DB.
    Folosit de load balancer pentru a decide dacă containerul acceptă trafic."""
    try:
        async for db in get_db():
            await db.execute(text("SELECT 1"))
            return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": str(e)},
        )
```

**Actualizare Docker Compose** — se adaugă healthcheck pe backend și `depends_on` condiționat pe frontend:

```yaml
  backend:
    # ... (configurare existentă)
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/live')"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

  frontend:
    # ... (configurare existentă)
    depends_on:
      backend:
        condition: service_healthy
```

---

### 2. Logging Structurat (JSON) cu Request Correlation

Se configurează logging-ul structurat cu `structlog` pentru a produce JSON logs parseabile de orice serviciu de log aggregation (Railway logs, Datadog, etc.):

```python
# server/app/core/logging_config.py
import logging
import structlog
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def setup_logging(log_level: str = "INFO") -> None:
    """Configurează structlog pentru output JSON structurat."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(format="%(message)s", level=getattr(logging, log_level))


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Atașează un correlation ID unic fiecărui request.
    Frontend-ul poate trimite X-Request-ID; altfel se generează unul."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            method=request.method,
            path=str(request.url.path),
        )

        logger = structlog.get_logger()
        logger.info("request_started")

        response = await call_next(request)

        logger.info("request_completed", status_code=response.status_code)
        response.headers["X-Request-ID"] = correlation_id
        return response
```

**Integrare în `app/main.py`**:
```python
from app.core.logging_config import setup_logging, RequestCorrelationMiddleware

# La startup
setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO"))
app.add_middleware(RequestCorrelationMiddleware)
```

**Dependință nouă** — adăugare în `requirements.txt`:
```text
structlog>=24.1.0
```

---

### 3. Graceful Shutdown & Lifecycle Events

Uvicorn trimite `SIGTERM` la restart/deploy. Fără handling explicit, conexiunile DB și request-urile in-flight sunt terminate brusc. Se folosesc lifecycle events FastAPI pentru curățare:

```python
# server/app/main.py — fragment lifecycle
from contextlib import asynccontextmanager
from app.database import engine
import structlog

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app):
    """Lifecycle manager — setup la startup, cleanup la shutdown."""
    logger.info("app_startup", message="Meridian backend starting")
    yield
    # Graceful shutdown: închide pool-ul de conexiuni DB
    logger.info("app_shutdown", message="Closing database connection pool")
    await engine.dispose()
    logger.info("app_shutdown_complete", message="All connections closed")


app = FastAPI(
    title="Meridian Onboarding API",
    lifespan=lifespan,
)
```

**Configurare Uvicorn pentru graceful shutdown** (în `docker-compose.yml`):
```yaml
  backend:
    # ...
    command: >
      uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
      --timeout-graceful-shutdown 30
    stop_grace_period: 35s
```
*Rațional*: Uvicorn are 30s să finalizeze request-urile in-flight. Docker așteaptă 35s (5s buffer) înainte de `SIGKILL`.

---

### 4. Validare Configurare la Startup (Pydantic Settings)

Se validează toate variabilele de mediu la boot, nu la prima cerere care le folosește. Fără asta, un `JWT_SECRET` lipsă = crash la primul login, nu la startup:

```python
# server/app/core/config.py
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Configurare centralizată — crash fast dacă lipsește ceva critic."""

    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")
    JWT_SECRET: str = Field(..., min_length=32, description="JWT signing secret")
    JWT_ALGORITHM: str = Field(default="HS256")
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")

    # Rate limiting
    LOGIN_RATE_LIMIT: str = Field(default="5/minute")
    REFRESH_RATE_LIMIT: str = Field(default="10/minute")

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173"],
        description="Allowed CORS origins",
    )

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}, got '{v}'")
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if v == "change-me" or v == "secret":
            raise ValueError("JWT_SECRET must not be a placeholder value")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


# Singleton — crash la import dacă configurarea e invalidă
settings = Settings()
```

**Fișier `.env.example`** (commituit în repo, servind ca documentație vie):
```bash
# .env.example — Copiază ca .env și completează valorile
# ⚠️ NU commitui .env-ul real!

# Database
POSTGRES_USER=meridian
POSTGRES_PASSWORD=SCHIMBA_ACEASTA_PAROLA
POSTGRES_DB=meridian_onboarding

# Backend
DATABASE_URL=postgresql+asyncpg://meridian:SCHIMBA_ACEASTA_PAROLA@db:5432/meridian_onboarding
JWT_SECRET=genereaza-un-secret-de-minim-32-caractere
JWT_ALGORITHM=HS256
ENVIRONMENT=development
LOG_LEVEL=INFO

# Frontend
VITE_API_URL=http://localhost:8000
```

---

### 5. Limite de Resurse pe Containere (OOM Prevention)

Fără limite, Argon2id (64 MiB/hash) × cereri concurente = OOM kill fără avertisment pe host-uri cu resurse limitate:

```yaml
# docker-compose.yml — adăugări la servicii existente
services:
  db:
    # ...
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 256M

  backend:
    # ...
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 256M

  frontend:
    # ...
    deploy:
      resources:
        limits:
          memory: 384M
          cpus: "0.5"
        reservations:
          memory: 128M
```

> [!TIP]
> Aceste limite funcționează cu `docker compose` v2+ (nu necesită Docker Swarm). Pentru Railway, limitele se setează din dashboard (default 512 MB pe free tier).

---

### 6. Strategia de Testare

Planul curent nu menționează teste. Se definește o piramidă de testare cu trei niveluri:

#### A. Teste Unitare (pytest + pytest-asyncio)

Testează logica de business izolat, fără DB reală. Se folosesc fixtures și mock-uri:

```python
# server/tests/unit/test_schedule_validation.py
import pytest
from app.services.schedule import validate_hybrid_week


class TestHybridWeekValidation:
    """Validare regulă: 3 zile office / 2 zile remote per săptămână."""

    def test_valid_schedule_3_office_2_remote(self):
        week = ["office", "office", "office", "remote", "remote"]
        assert validate_hybrid_week(week) is True

    def test_reject_4_office_days(self):
        week = ["office", "office", "office", "office", "remote"]
        with pytest.raises(ValueError, match="maximum 3 office days"):
            validate_hybrid_week(week)

    def test_reject_3_remote_days(self):
        week = ["remote", "remote", "remote", "office", "office"]
        with pytest.raises(ValueError, match="maximum 2 remote days"):
            validate_hybrid_week(week)

    def test_partial_week_allowed(self):
        """Angajat nou care începe miercuri — doar 3 zile în prima săptămână."""
        partial = ["office", "office", "remote"]
        assert validate_hybrid_week(partial) is True
```

#### B. Teste de Integrare (testcontainers-python)

Testează interacțiunea reală cu PostgreSQL într-un container efemer:

```python
# server/tests/integration/conftest.py
import pytest_asyncio
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database import Base


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Creează un container PostgreSQL efemer pentru sesiunea de teste."""
    with PostgresContainer("postgres:16-alpine") as pg:
        url = pg.get_connection_url().replace("psycopg2", "asyncpg")
        engine = create_async_engine(url, echo=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        yield engine
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Sesiune DB cu rollback automat după fiecare test."""
    async_session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()
```

```python
# server/tests/integration/test_employee_crud.py
import pytest
from app.services.employees import create_employee, get_employee_by_email


@pytest.mark.asyncio
async def test_create_and_retrieve_employee(db_session):
    """Verifică ciclul complet: creare -> citire din DB reală."""
    emp = await create_employee(
        db_session,
        name="Ana Popescu",
        email="ana@meridian.com",
        department="Engineering",
    )
    assert emp.id is not None

    found = await get_employee_by_email(db_session, "ana@meridian.com")
    assert found.name == "Ana Popescu"
    assert found.department == "Engineering"


@pytest.mark.asyncio
async def test_duplicate_email_rejected(db_session):
    """Verifică constrângerea UNIQUE pe email."""
    await create_employee(db_session, name="Ion", email="dup@meridian.com", department="HR")
    with pytest.raises(Exception):  # IntegrityError wrapped
        await create_employee(db_session, name="Maria", email="dup@meridian.com", department="Sales")
```

#### C. Teste API End-to-End (httpx + TestClient)

Testează endpoint-urile HTTP complet, inclusiv auth flow:

```python
# server/tests/e2e/test_auth_flow.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_full_auth_lifecycle():
    """Login -> Access Protected -> Refresh -> Access Again -> Logout."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login
        resp = await client.post("/auth/login", json={
            "email": "admin@meridian.com",
            "password": "test-password-123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.cookies

        # 2. Access protected endpoint
        resp = await client.get("/employees/me")
        assert resp.status_code == 200

        # 3. Health check (nu necesită auth)
        resp = await client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["database"] == "connected"
```

**Configurare pytest** (`server/pyproject.toml`):
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
markers = [
    "unit: Teste unitare fără dependențe externe",
    "integration: Teste cu DB reală (testcontainers)",
    "e2e: Teste end-to-end pe API complet",
]
filterwarnings = ["ignore::DeprecationWarning"]

[tool.coverage.run]
source = ["app"]
omit = ["app/alembic/*", "tests/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

**Dependințe test** (`server/requirements-dev.txt`):
```text
pytest>=8.0
pytest-asyncio>=0.23
pytest-cov>=5.0
httpx>=0.27
testcontainers[postgres]>=4.0
factory-boy>=3.3
```

---

### 7. Pipeline CI/CD (GitHub Actions)

Pipeline care rulează la fiecare push și PR, cu trei stadii: lint → test → build:

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "20"

jobs:
  # ─── Stage 1: Lint & Type Check ─────────────────────────
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - name: Install dependencies
        run: |
          cd server
          pip install -r requirements.txt -r requirements-dev.txt
          pip install ruff mypy

      - name: Ruff lint
        run: cd server && ruff check .

      - name: Ruff format check
        run: cd server && ruff format --check .

      - name: MyPy type check
        run: cd server && mypy app/ --ignore-missing-imports

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: ESLint frontend
        run: npm ci && npm run lint

  # ─── Stage 2: Test ──────────────────────────────────────
  test-backend:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: test_meridian
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test_user"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql+asyncpg://test_user:test_pass@localhost:5432/test_meridian
      JWT_SECRET: ci-test-secret-minimum-32-characters-long
      ENVIRONMENT: development

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - name: Install dependencies
        run: |
          cd server
          pip install -r requirements.txt -r requirements-dev.txt

      - name: Run Alembic migrations
        run: cd server && alembic upgrade head

      - name: Run tests with coverage
        run: |
          cd server
          pytest --cov --cov-report=xml --cov-report=term -v

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: server/coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install and test
        run: |
          npm ci
          npm run test -- --coverage --watchAll=false

  # ─── Stage 3: Build Verification ───────────────────────
  build:
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    steps:
      - uses: actions/checkout@v4

      - name: Build backend Docker image
        run: docker build -t meridian-backend:ci ./server

      - name: Build frontend
        run: |
          npm ci
          npm run build

      - name: Verify Alembic heads
        run: |
          cd server
          pip install -r requirements.txt
          python -c "
          import subprocess
          result = subprocess.run(['alembic', 'heads'], capture_output=True, text=True)
          heads = [l for l in result.stdout.strip().split('\n') if l.strip()]
          assert len(heads) == 1, f'Multiple Alembic heads detected: {heads}. Run alembic merge.'
          print(f'✅ Single migration head: {heads[0]}')
          "
```

---

### 8. Migrații Alembic — Rollback Plan & Safety

#### A. Procedură de Rollback Documentată

Fiecare migrație Alembic trebuie să aibă un `downgrade()` funcțional. Procedura de rollback pentru Railway:

```bash
# Rollback local (development)
alembic downgrade -1          # Revert ultima migrație
alembic current               # Verifică starea curentă

# Rollback pe Railway (production)
# 1. Setează Pre-Deploy Command temporar:
#    alembic downgrade -1 && alembic upgrade head
# 2. Sau rulează manual via Railway CLI:
railway run alembic downgrade -1
```

#### B. Verificare Automată Pre-Migrație

Script care validează migrațiile înainte de aplicare:

```python
# server/scripts/check_migrations.py
"""Verificări de siguranță pre-migrație Alembic."""
import subprocess
import sys


def check_single_head():
    """Detectează branch-uri de migrație nemerged (head multiplu)."""
    result = subprocess.run(["alembic", "heads"], capture_output=True, text=True)
    heads = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
    if len(heads) != 1:
        print(f"❌ Multiple migration heads: {heads}")
        print("   Rezolvare: alembic merge -m 'merge heads' <head1> <head2>")
        sys.exit(1)
    print(f"✅ Single head: {heads[0]}")


def check_pending_migrations():
    """Verifică dacă există migrații neaplicate."""
    result = subprocess.run(["alembic", "check"], capture_output=True, text=True)
    if result.returncode != 0:
        print("⚠️  Migrații pending detectate. Rulează: alembic upgrade head")
        sys.exit(1)
    print("✅ Toate migrațiile sunt aplicate")


if __name__ == "__main__":
    check_single_head()
    check_pending_migrations()
    print("\n✅ Migration checks passed")
```

---

### 9. Backup/Restore — Validare & Recovery

#### A. Validare Integritate la Import

Endpoint-ul de restore trebuie să valideze datele înainte de a le scrie în DB:

```python
# server/app/services/backup.py — fragment validare
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


class BackupEmployeeSchema(BaseModel):
    """Schema de validare pentru fiecare angajat din fișierul de backup."""
    name: str
    email: str
    department: str
    hire_date: date
    role: str

    @field_validator("department")
    @classmethod
    def validate_department(cls, v: str) -> str:
        valid = {"Engineering", "Sales", "Marketing", "HR", "Finance"}
        if v not in valid:
            raise ValueError(f"Department invalid: '{v}'. Permise: {valid}")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid = {"hr_admin", "employee", "preboardee"}
        if v not in valid:
            raise ValueError(f"Role invalid: '{v}'. Permise: {valid}")
        return v


class BackupPayload(BaseModel):
    """Schema completă de validare a fișierului de backup."""
    version: str
    exported_at: str
    employees: list[BackupEmployeeSchema]
    checklist_tasks: list[dict]  # Validate separat
    schedule_entries: list[dict]

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        if v != "1.0":
            raise ValueError(f"Versiune backup nesuportată: {v}")
        return v
```

#### B. Restore cu Savepoint (Atomic Rollback)

```python
async def restore_database(db: AsyncSession, payload: BackupPayload) -> dict:
    """Restaurare atomică — fie totul se scrie, fie nimic."""
    try:
        # Validare FK-uri: toate employee_id-urile din checklist_tasks
        # trebuie să existe în lista de employees
        employee_emails = {e.email for e in payload.employees}
        # ... validare integritate referențială ...

        async with db.begin():
            # Lock exclusiv pe tabele (previne citiri inconsistente)
            await db.execute(text(
                "LOCK TABLE employees, checklist_tasks, schedule_entries "
                "IN ACCESS EXCLUSIVE MODE"
            ))

            # Truncate în ordinea corectă (child tables first)
            await db.execute(text("TRUNCATE schedule_entries CASCADE"))
            await db.execute(text("TRUNCATE checklist_tasks CASCADE"))
            await db.execute(text("TRUNCATE employees CASCADE"))

            # Re-populate
            for emp_data in payload.employees:
                # ... inserare angajați ...
                pass

            # Verificare post-restore
            count = await db.scalar(text("SELECT COUNT(*) FROM employees"))
            if count != len(payload.employees):
                raise RuntimeError(
                    f"Restore integrity check failed: expected {len(payload.employees)}, "
                    f"got {count}"
                )

        return {"status": "success", "employees_restored": len(payload.employees)}

    except Exception as e:
        # Tranzacția face rollback automat via context manager
        raise RestoreError(f"Restore failed, database unchanged: {str(e)}")
```

---

### 10. Makefile & Scripturi DX

Un `Makefile` la root-ul proiectului care oferă shortcuts pentru toate operațiile comune:

```makefile
# Makefile — Meridian Onboarding DX Shortcuts
.PHONY: help setup up down restart logs test lint migrate seed clean

# ─── Meta ─────────────────────────────────────────────────
help: ## Afișează această listă de comenzi
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Setup ────────────────────────────────────────────────
setup: ## Setup inițial: copiază .env, instalează dependințe
	@test -f .env || cp .env.example .env
	@echo "✅ .env creat (editează-l cu credentialele tale)"
	docker compose build
	cd server && pip install -r requirements.txt -r requirements-dev.txt
	npm install
	@echo "✅ Setup complet. Rulează: make up"

# ─── Docker Compose ──────────────────────────────────────
up: ## Pornește toate serviciile
	docker compose up -d
	@echo "🚀 Backend: http://localhost:8000"
	@echo "🚀 Frontend: http://localhost:5173"
	@echo "🚀 DB: localhost:5432"

down: ## Oprește toate serviciile
	docker compose down

restart: ## Restart toate serviciile
	docker compose restart

logs: ## Afișează loguri live (toate serviciile)
	docker compose logs -f --tail=50

logs-backend: ## Loguri doar backend
	docker compose logs -f --tail=100 backend

logs-db: ## Loguri doar DB
	docker compose logs -f --tail=100 db

# ─── Database ────────────────────────────────────────────
migrate: ## Rulează migrațiile Alembic
	docker compose exec backend alembic upgrade head

migrate-new: ## Generează o migrație nouă (usage: make migrate-new MSG="add users table")
	docker compose exec backend alembic revision --autogenerate -m "$(MSG)"

migrate-rollback: ## Rollback ultima migrație
	docker compose exec backend alembic downgrade -1

migrate-check: ## Verifică starea migrațiilor
	docker compose exec backend python scripts/check_migrations.py

seed: ## Populează DB-ul cu date de test
	docker compose exec backend python scripts/seed_data.py

db-shell: ## Deschide psql shell
	docker compose exec db psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}

# ─── Testing ─────────────────────────────────────────────
test: ## Rulează toate testele backend
	cd server && pytest -v --tb=short

test-unit: ## Doar teste unitare
	cd server && pytest -v -m unit

test-integration: ## Doar teste de integrare (necesită Docker)
	cd server && pytest -v -m integration

test-cov: ## Teste cu coverage report
	cd server && pytest --cov --cov-report=html --cov-report=term
	@echo "📊 Coverage report: server/htmlcov/index.html"

test-frontend: ## Teste frontend
	npm run test -- --watchAll=false

# ─── Linting ─────────────────────────────────────────────
lint: ## Lint complet (backend + frontend)
	cd server && ruff check . && ruff format --check .
	npm run lint

lint-fix: ## Auto-fix lint issues
	cd server && ruff check --fix . && ruff format .
	npm run lint -- --fix

# ─── Cleanup ─────────────────────────────────────────────
clean: ## Șterge volumele Docker și cache-urile
	docker compose down -v --remove-orphans
	find server -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf server/.pytest_cache server/htmlcov server/.mypy_cache
	@echo "🧹 Cleanup complet"

nuke: ## ⚠️ Resetare totală (inclusiv date DB)
	docker compose down -v --remove-orphans --rmi local
	@echo "💀 Totul a fost șters. Rulează: make setup"
```

---

### 11. Seed Data Script (Date de Test)

Script care populează baza de date cu date realiste pentru development:

```python
# server/scripts/seed_data.py
"""Populează DB-ul cu date de test pentru development."""
import asyncio
from datetime import date, timedelta
from app.database import engine, Base, async_session
from app.models import Employee, ChecklistTask, ScheduleEntry
import structlog

logger = structlog.get_logger()

DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance"]

SEED_EMPLOYEES = [
    {"name": "Elena Ionescu", "email": "elena@meridian.com", "department": "HR", "role": "hr_admin"},
    {"name": "Andrei Popa", "email": "andrei@meridian.com", "department": "Engineering", "role": "employee"},
    {"name": "Maria Dumitrescu", "email": "maria@meridian.com", "department": "Sales", "role": "employee"},
    {"name": "Bogdan Stancu", "email": "bogdan@meridian.com", "department": "Marketing", "role": "employee"},
    # New hire — starts next week (preboardee)
    {"name": "Sofia Radu", "email": "sofia@meridian.com", "department": "Engineering", "role": "preboardee",
     "hire_date": date.today() + timedelta(days=7)},
]

DEFAULT_CHECKLIST = [
    {"title": "Semnare contract", "category": "HR", "is_required": True},
    {"title": "Setup laptop & conturi", "category": "IT", "is_required": True},
    {"title": "Tour birou", "category": "General", "is_required": False},
    {"title": "Întâlnire cu team lead", "category": "Team", "is_required": True},
    {"title": "Training securitate date", "category": "Compliance", "is_required": True},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Check if already seeded
        from sqlalchemy import select, func
        count = await session.scalar(select(func.count()).select_from(Employee))
        if count and count > 0:
            logger.info("seed_skip", message=f"DB already has {count} employees, skipping seed")
            return

        for emp_data in SEED_EMPLOYEES:
            emp = Employee(**emp_data)
            session.add(emp)

        await session.flush()  # Get IDs

        logger.info("seed_complete", employees=len(SEED_EMPLOYEES))
        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
```

---

### 12. Error Handling Global (Exception Handlers)

Handler centralizat care convertește excepții în response-uri JSON consistente, fără a expune stack traces în producție:

```python
# server/app/core/error_handlers.py
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
import structlog

logger = structlog.get_logger()


def register_error_handlers(app: FastAPI) -> None:
    """Înregistrează handlere globale de erori."""

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        logger.warning("validation_error", errors=exc.errors(), path=str(request.url))
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "detail": exc.errors(),
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        logger.error("integrity_error", detail=str(exc.orig), path=str(request.url))
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "conflict",
                "detail": "A database constraint was violated (e.g., duplicate entry).",
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception):
        logger.exception("unhandled_error", path=str(request.url))
        # Nu expune detalii în producție
        from app.core.config import settings
        detail = str(exc) if settings.ENVIRONMENT == "development" else "Internal server error"
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "internal_error", "detail": detail},
        )
```

---

### 13. Sumar Fișiere Noi & Modificate (Iterația 4)

| Fișier | Tip | Scop |
|---|---|---|
| `server/app/routes/health.py` | Nou | Liveness & readiness probes |
| `server/app/core/logging_config.py` | Nou | Logging structurat JSON + correlation middleware |
| `server/app/core/config.py` | Nou | Validare env vars la startup cu Pydantic Settings |
| `server/app/core/error_handlers.py` | Nou | Exception handlers globale |
| `server/scripts/check_migrations.py` | Nou | Verificare pre-migrație Alembic |
| `server/scripts/seed_data.py` | Nou | Date de test pentru development |
| `server/requirements-dev.txt` | Nou | Dependințe test (pytest, httpx, testcontainers) |
| `server/pyproject.toml` | Modificat | Configurare pytest, coverage, markers |
| `.env.example` | Nou | Template documentat pentru variabile de mediu |
| `.github/workflows/ci.yml` | Nou | Pipeline CI/CD complet |
| `Makefile` | Nou | DX shortcuts pentru toate operațiile |
| `docker-compose.yml` | Modificat | +healthcheck backend, +resource limits, +graceful shutdown |
| `server/requirements.txt` | Modificat | +structlog, +pydantic-settings |
