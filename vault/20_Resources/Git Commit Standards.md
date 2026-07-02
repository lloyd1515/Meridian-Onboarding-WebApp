---
title: Git Commit Standards
tags: [git, standards, workflow, best-practices]
aliases: [Git Commit Guide, Commit Rules]
---

# Git Commit Standards & Best Practices

This guide outlines industry-standard practices for version control using Git. Following these guidelines ensures that our commit history remains clean, readable, and compatible with automated release and versioning tooling.

---

## 1. Commit Message Structure (Conventional Commits)

We follow the **Conventional Commits** specification. This format provides a structured, predictable way to document changes.

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 1.1 Commit Types
The type describes the intent of the change. Use one of the following:

| Type | Meaning | SemVer Impact |
| :--- | :--- | :--- |
| `feat` | A new feature | `MINOR` |
| `fix` | A bug fix | `PATCH` |
| `docs` | Documentation changes only | None |
| `style` | Formatting, missing semi-colons, etc. (no logic change) | None |
| `refactor` | Code restructuring (neither fixes a bug nor adds a feature) | None |
| `perf` | Code change that improves performance | None |
| `test` | Adding missing tests or correcting existing tests | None |
| `build` / `chore` | Build system, external dependencies, CI, or tool configs | None |

> [!TIP]
> Introducing a breaking change? Append a `!` after the type/scope or add `BREAKING CHANGE:` in the footer to trigger a `MAJOR` SemVer bump.
> Example: `feat(auth)!: remove basic auth support`

### 1.2 Scopes
An optional noun describing the module or section of the codebase affected, enclosed in parentheses.
- Example: `feat(api): add list endpoints` or `fix(frontend): resolve login loading state`

---

## 2. Formatting Rules (The 50/72 Rule)

To keep commits readable across standard terminals, IDE integrations, and repository hosting services (like GitHub or GitLab):

1. **Limit the subject line to 50 characters**: Subject lines exceeding 50 characters are truncated or wrapped awkwardly.
2. **Capitalize the subject line**: Begin the description with a capital letter.
3. **Do not end the subject line with a period**: Keep it as a concise title.
4. **Use the imperative mood**: Write the subject line as a command (e.g., `"Add database index"` instead of `"Added database index"` or `"Adds database index"`).
5. **Separate subject and body with a blank line**: Git automatically parses the first line as the summary, and subsequent lines as the body.
6. **Wrap the body at 72 characters**: Ensures compatibility with terminal formatting and prevents horizontal scrolling.
7. **Explain the *what* and *why*, not the *how***: The code explains the *how*. The message must explain *why* the change was made and *what* problem it solves.

> [!IMPORTANT]
> A well-structured commit message:
> ```text
> feat(auth): implement JWT refresh token flow
> 
> Users were getting logged out immediately upon token expiration.
> This change implements an automatic refresh token request flow on
> the client side before executing authenticated requests.
> 
> Closes: #143
> ```

---

## 3. Commit Size & Frequency (Atomic Commits)

### 3.1 Keep Commits Atomic
An **atomic commit** encapsulates a single, logical change.
- **Single Responsibility**: Do not mix a bug fix, a new feature, and unrelated formatting into one commit. Split them.
- **Reversibility**: If a commit introduces a regression, you must be able to run `git revert <commit-hash>` to clean it out cleanly without losing unrelated changes.
- **Stability**: The build should never be broken, and all tests must pass after every commit.

### 3.2 Commit Often, Squash Before Push
- **Local Checkpoints**: Commit frequently while developing locally to checkpoint your work.
- **Clean Shared History**: Use interactive rebasing (`git rebase -i`) to squash, split, or reword local commits into clean, logical atomic units *before* pushing them to remote branches or submitting a Pull Request.

---

## 4. Git Workflow Order

For collaboration safety and history linearity, follow this order:

1. **Update Local Main**: Bring local `main` or `develop` branch up to date with remote updates.
   ```bash
   git checkout main && git pull origin main
   ```
2. **Create Feature Branch**: Use a descriptive branch name prefix (e.g. `feature/`, `bugfix/`).
   ```bash
   git checkout -b feature/login-page
   ```
3. **Commit Incrementally**: Work on your feature and make atomic commits locally.
4. **Rebase feature branch**: Before sharing, update your branch against the latest remote changes to maintain a clean linear timeline.
   ```bash
   git fetch origin
   git rebase origin/main
   ```
   > [!CAUTION]
   > **Never** rebase public/shared branches that other team members are actively working on.
5. **Push and PR**: Push to remote and open a Pull Request for review.
6. **Squash and Merge**: After approvals and CI validation, merge using a squash merge to keep the parent branch history concise.

---

## Related Notes
- [[Welcome]]
- [[Commit History Evaluation]]
