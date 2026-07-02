---
title: E2E Subagent Swarm & Shared Context Engine Specifications
tags: [architecture, subagent-swarm, chromedevtools, github-actions, ci-cd, shared-context, specifications]
aliases: [Subagent Swarm Specs]
---

# E2E Subagent Swarm & Shared Context Engine Specifications

## 1. Shared Context Engine Schema (`.omg/state/shared_context.json`)

```json
{
  "session_id": "e2e-swarm-session-001",
  "commit_diff_hash": "a8f932c1",
  "modified_files": [
    "src/features/onboarding/OnboardingChecklist.tsx"
  ],
  "modified_symbols": [
    "OnboardingChecklist#handleCopySlackIntro",
    "OnboardingChecklist#formatSlackIntroMessage"
  ],
  "test_status": {
    "vitest": "PASS",
    "pytest": "PASS"
  },
  "security_status": "PASS",
  "solid_grasp_status": "PASS",
  "chromedevtools_cdp": {
    "port": 9222,
    "target_url": "http://localhost:5173/#/onboarding",
    "status": "VERIFIED_VISIBLE"
  }
}
```

---

## 2. Subagent Invocation Rules & Token Compression

To minimize token usage during swarm execution:
1. **Never pass entire source code files** in subagent prompts.
2. **Pass exact diff lines** (`git diff HEAD~1..HEAD`) + target symbol references.
3. **Reference shared context state** via `.omg/state/shared_context.json`.

---

## 3. ChromeDevTools E2E Subagent Specification

```json
{
  "TypeName": "self",
  "Role": "ChromeDevTools E2E Subagent",
  "Prompt": "Connect to Microsoft Edge CDP on port 9222. Navigate to modified page route, execute interaction flow (click, fill, verify DOM state), check console messages for errors, and verify accessible aria-live announcements."
}
```
