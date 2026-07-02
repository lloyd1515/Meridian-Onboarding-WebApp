---
title: CI/CD Standards & Guidelines
tags: [cicd, standards, workflow, best-practices, github-actions, security]
aliases: [CI/CD Guide, CI CD Rules, Pipeline Standards]
---

# CI/CD Standards & Best Practices

This guide outlines mandatory standards, rules, and research-backed best practices for configuring, modifying, and executing CI/CD workflows across the codebase. Following these guidelines ensures consistent builds, zero secret leaks, fast feedback loops, and 100% reliable GitHub Actions execution.

---

## 1. Runtime & Dependency Standards

1. **Strict Lockfile Synchronization (`npm ci`)**:
   - Always run `npm install` after modifying `package.json` to ensure `package-lock.json` is synchronized before committing.
   - Workflows must use `npm ci` (not `npm install`) for deterministic, reproducible builds. In CI, `npm ci` enforces strict lockfile adherence and fails immediately if `package.json` and `package-lock.json` are out of sync.

2. **Target Runtimes**:
   - Frontend & Node tooling: **Node.js 22 LTS** (or Node.js 20 LTS minimum).
   - Backend Python tooling: **Python 3.12** (or Python 3.11 minimum).

3. **Complete Dependency Installation**:
   - Backend CI jobs must install both production dependencies (`server/requirements.txt`) and dev dependencies (`server/requirements-dev.txt`) before running tests.

---

## 2. Environment & Network Host Binding Standards

1. **Explicit IPv4 Loopback Binding (`127.0.0.1`)**:
   - Development servers and E2E test runners (Vite, Playwright, FastAPI) must explicitly bind to IPv4 `127.0.0.1` (e.g. `--host 127.0.0.1 --port 5173`).
   - In Node 18+, Node.js DNS resolution defaults to IPv6 (`::1`) before IPv4. If a local server binds only to IPv4 `127.0.0.1` while Playwright polls `http://localhost:5173`, connection fails with `ECONNREFUSED` or times out.
   - To force Node.js test runners to prioritize IPv4 DNS resolution, set:
     ```typescript
     import dns from 'node:dns';
     dns.setDefaultResultOrder('ipv4first');
     ```

2. **Environment File & Variable Fallbacks**:
   - Workflows running Docker Compose builds must prepare a default `.env` file (e.g. `cp .env.example .env`) and supply fallback environment variables before building.
   - Docker Compose services must define default variable fallbacks (e.g. `${POSTGRES_USER:-meridian_user}`).

---

## 3. Security & Secret Scanning Standards

1. **Zero Hardcoded Credentials**:
   - Never commit real passwords, tokens, API keys, or high-entropy secret strings in any file (including `.env.example`).

2. **Generic Placeholder Rule**:
   - Configuration templates (`.env.example`) must use standardized generic placeholders (e.g., `your_postgres_password_here`, `change_me_in_production`).

3. **Gitleaks Allowlist & Full History Policy**:
   - Secret scanning steps must reference a project-level [.gitleaks.toml](file:///D:/ForJobs/Qubiz/.gitleaks.toml) configuration that explicitly allowlists sanitized `.env.example` placeholder patterns.
   - Always use `fetch-depth: 0` in `actions/checkout@v4` so Gitleaks scans the complete commit history rather than just the shallow latest commit.

---

## 4. Test Suite Execution Standards

1. **Frontend Vitest Suite**:
   - `vite.config.ts` must configure test `include` and `exclude` patterns to prevent scanning local browser cache directories (`chrome_profile_*`, `edge_profile_*`, `pw_*`).
   - Enable `passWithNoTests: true` so unit test runners exit cleanly (`exit code 0`) when no test files are matched.

2. **Backend Pytest Suite**:
   - Pytest execution must set `PYTHONPATH=server` or execute within the `server/` directory to ensure module resolution (`from app.core...`).

3. **Playwright E2E Suite**:
   - Configure Playwright with a `webServer` block (`npm run dev -- --host 127.0.0.1`) and set explicit timeouts (`120s`) for headless runner startup.

---

## 5. Agent Workflow Rules (When Modifying CI/CD)

Whenever an AI agent updates CI/CD workflow files, dependencies, or test configurations, the agent **MUST**:

1. **Run Tier 1 Static Type Check**: Execute `npx tsc --noEmit` locally and verify zero compilation errors.
2. **Verify Lockfile Integrity**: Ensure `package-lock.json` is committed alongside any `package.json` changes.
3. **Verify Local Test Execution**: Run `npm test -- --run` and Pytest locally to verify passing test suites.
4. **Sanitize Secrets**: Ensure no test tokens or entropy strings trigger Gitleaks scanner rules.
5. **Enforce Atomic Conventional Commits**: Commit changes using standard conventional commit formatting (e.g. `fix(ci): ...` or `chore(ci): ...`) following the 50/72 rule.

---

## Related Notes
- [[Git Commit Standards]]
- [[Welcome]]
