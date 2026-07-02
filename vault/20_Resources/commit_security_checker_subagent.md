---
title: Commit Security Checker & Auto-Remediation Subagent Specification
tags: [security, subagent, gitnexus, vulnerability-scanner, auto-fix-spec]
aliases: [Commit Security Subagent Spec]
---

# Commit Security Checker & Auto-Remediation Subagent Specification

## Overview
This specification details the **subagent handoff protocol** and **auto-remediation workflow** for commit diff auditing.

---

## Subagent Hand-Off Protocol

### Step 1: Commit Security Auditor Invocation
```json
{
  "TypeName": "oma-reviewer",
  "Role": "Commit Security Auditor",
  "Prompt": "Audit ONLY the git commit diff (git diff HEAD~1..HEAD or staged changes) for security vulnerabilities, secrets, and OWASP flaws. Return findings. If findings exist, trigger Security Fix Executor."
}
```

### Step 2: Security Fix Executor Invocation (On Findings)
```json
{
  "TypeName": "oma-executor",
  "Role": "Security Fix Executor",
  "Prompt": "Review reported security findings for the commit diff. Develop a surgical fix plan and apply necessary code updates strictly to the affected lines. Do not alter unrelated code."
}
```

### Step 3: Re-Audit & User Escalation Rule
- The Auditor re-scans the updated diff.
- **Iteration Count <= 2**: Auto-fix and re-scan loop continues.
- **Iteration Count > 2**: If findings are still unresolved after 2 fix attempts, output the **Escalation Report** to the user:

```markdown
🚨 **Security Escalation Alert**: Unresolved Findings After 2 Fix Attempts
- **Commit Diff**: [File & Lines]
- **Remaining Issues**: [List of Findings]
- **User Action Required**: Manual review or decision needed.
```
