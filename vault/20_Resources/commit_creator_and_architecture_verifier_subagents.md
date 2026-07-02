---
title: Upgraded Two-Tiered Pre-Commit Subagent Specifications
tags: [architecture, subagent, solid-principles, grasp-patterns, gitnexus, parallel-pipeline]
aliases: [Two-Tiered Subagent Specs]
---

# Upgraded Two-Tiered Pre-Commit Subagent Specifications

## 1. Pipeline Execution Profiles

| Profile | Command Trigger | Tier 1 Checks | Tier 2 Parallel Subagents |
| --- | --- | --- | --- |
| **`fast`** (Default Dev Loop) | `git commit` | Static Type Check (`tsc --noEmit`) | Security Auditor Subagent |
| **`strict`** (Pre-Push / PR) | `git push` / `/oma:goal` | Type Check + Regex Secret Scan | Parallel SOLID/GRASP Verifier + Security Auditor + GitNexus Graph Analysis |

---

## 2. Subagent Specifications

### 1. Commit Creator Subagent (`commit-creator`)
- **Role**: Groups diffs into small, single-purpose micro-commits and generates vault `CHANGELOG.md` entries (`### [Commit N] - Title`).

### 2. SOLID & GRASP Architecture Verifier Subagent (`architecture-verifier`)
- **Role**: Audits **diffs only** for SOLID principles and GRASP object-design patterns.
- **GitNexus Integration**: Uses `gitnexus impact` and `route_map` to evaluate coupling and cohesion across import boundaries.

### 3. Commit Security Auditor Subagent (`commit-security-checker`)
- **Role**: Audits **diffs only** for secret leaks and OWASP flaws.
- **GitNexus Integration**: Uses `gitnexus explain` and `trace` for source-to-sink taint analysis.

### 4. Security Fix Executor Subagent (`security-remediator`)
- **Role**: Applies surgical fixes when vulnerabilities are detected, verifies type compilation, and stages cleanly.

---

## 3. Parallel Execution Protocol
```json
{
  "PipelineMode": "parallel",
  "Tier1": ["tsc --noEmit"],
  "Tier2": [
    { "Subagent": "architecture-verifier", "Scope": "diff-only", "GitNexus": true },
    { "Subagent": "commit-security-checker", "Scope": "diff-only", "GitNexus": true }
  ],
  "MaxFixAttempts": 2
}
```
