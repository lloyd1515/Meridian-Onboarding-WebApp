---
name: subagent-swarm
description: Orchestrate a pre-commit/pre-push swarm of specialized subagents to verify static compilation, security integrity, SOLID/GRASP design patterns, and E2E browser reliability.
---

# Subagent Swarm Quality Verification Skill

This workspace-scoped skill orchestrates a multi-agent verification swarm to ensure that all changes adhere to local guidelines, code style rules, security compliance, and testing standards before they are committed or pushed to remote.

---

## 1. Execution Profiles & Modes

When this skill is activated, you must parse the requested **mode** or **arguments**:

| Profile | Trigger Condition | Tasks Executed | Focus / Objective |
| :--- | :--- | :--- | :--- |
| **`fast`** | Default development check, local `git commit` | 1. TypeScript compilation check<br>2. Gitleaks regex scanning<br>3. Unit/Integration tests | Rapid developer feedback (< 2 mins) |
| **`strict`** | Pull requests, pre-push, `/oma:goal` | 1. Full Fast check<br>2. SOLID & GRASP subagent check<br>3. E2E ChromeDevTools MCP test | Strict validation & contract assurance |

---

## 2. Swarm Orchestration Protocol

When running the swarm, follow these steps sequentially:

### Step 1: Tier 1 Fast Static Gate
Run the following checks directly:
1. **TypeScript Type Check**: Run `npx tsc --noEmit` in the workspace root.
2. **Lockfile Synchronization**: Verify `package.json` and `package-lock.json` are synchronized.
3. **Secret Scan**: Run a local Gitleaks check or verify that no plain-text credentials or high-entropy tokens are present in the staged diffs.

### Step 2: Tier 2 Parallel Subagent Audits (Strict Profile Only)
Spawn specialized subagents to analyze the code diffs:
1. **`commit-security-checker`** (Role: "Security Auditor"):
   - Prompt: *Analyze the staged git diffs. Scan for potential secrets, hardcoded endpoints, or OWASP vulnerabilities. Query GitNexus `explain` or `trace` for source-to-sink data flows in modified files.*
2. **`architecture-verifier`** (Role: "SOLID & GRASP Architect"):
   - Prompt: *Analyze the staged git diffs. Ensure compliance with SOLID principles and GRASP patterns. Check if modified classes/functions have high cohesion and low coupling. Query GitNexus `impact` to ensure the blast radius is within acceptable limits.*

### Step 3: Tier 3 E2E & Browser Gate
Verify UI changes live using ChromeDevTools:
1. **`chromedevtools-e2e`** (Role: "ChromeDevTools Verifier"):
   - Prompt: *Connect to the dev server via ChromeDevTools MCP on port 9222. Navigate to modified page layouts/flows, trigger clicks/fills, and verify DOM responsiveness and accessibility (aria-live).*

### Step 4: Tier 4 Automated Test Suites
Run the local test suites to ensure zero regressions:
1. **Frontend Vitest**: Run `npm test -- --run`.
2. **Backend Pytest**: Run `server\.venv\Scripts\python.exe -m pytest server/tests`.

---

## 3. Failure Policy & Remediation (Fail-Closed)

- **Fail-Closed**: If any check fails, stop execution immediately. Do not commit or push the code.
- **Auto-Fix Gate**: If a check fails due to formatting, imports, or minor syntax errors, spawn the `oma-executor` subagent to perform surgical fixes, re-run verification, and attempt to resolve the issue automatically.

---

## 4. Usage Commands

Recommend these instructions to the user:
- To run a fast validation:
  `agy subagent-swarm --profile=fast`
- To run a full strict validation:
  `agy subagent-swarm --profile=strict`
