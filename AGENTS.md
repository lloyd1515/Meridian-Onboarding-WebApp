# Agent Rules and Guidelines

- **Divide et Impera**: Split all complex tasks into smaller, manageable subtasks.
- **Use Subagents**: For any substantial task, define and invoke specialized subagents (e.g. for reading files, writing code, executing tests, or doing research) to maintain context clarity and clean workspace separation.
- **Test-Driven Alignment**: You are not allowed to modify tests unless you are adding new features. You must never modify existing tests to accommodate code changes; the application features must adapt to the tests, not the other way around.
- **Obsidian Vault Organization & Schema**: Maintain the structured Obsidian vault located at `vault/` using the PARA method:
  - `vault/01_Inbox/` for quick capture, ideas, temporary decision synthesis logs, and unclassified notes (e.g. `brutally_honest_pipeline_synthesis.md`).
  - `vault/10_Projects/` for active project blueprints, architecture specs, and implementation plans (e.g. `production_agentic_pipeline_v2_1_blueprint.md`, `commit_creator_architecture_verifier_blueprint.md`, `cicd_architecture_verifier_blueprint.md`).
  - `vault/20_Resources/` for static guidelines, specifications, security standards, and research:
    - **Git Commit Standards**: `vault/20_Resources/Git Commit Standards.md` (Conventional Commits, 50/72 Rule, Atomic Commits).
    - **CI/CD Standards**: `vault/20_Resources/CI CD Standards.md` (Deterministic `npm ci` lockfiles, IPv4 `127.0.0.1` host binding, Gitleaks allowlist, dev-dependencies inclusion).
    - **Subagent Specifications**: `vault/20_Resources/commit_creator_and_architecture_verifier_subagents.md`, `vault/20_Resources/cicd_architecture_verifier_subagent.md`.
  - `vault/30_Archive/` for completed, inactive, or historical logs/notes.
  - `vault/40_Canvas/` for visual charts, architectural maps, and canvas diagrams (e.g. `subagent_architecture.canvas`).
- **Obsidian Note Formatting Rules**: All markdown notes created or edited in `vault/` MUST include YAML frontmatter (`title`, `tags`, `aliases`, `type`), use internal wikilinks (`[[Note Name]]`), standard GitHub alerts (`> [!NOTE]`, `> [!IMPORTANT]`), and error-free Mermaid diagrams.
- **Artifacts and Scratch Files**: Put all conceptual/technical notes, architectural blueprints, ideas, and generated code artifacts directly into the appropriate vault folder instead of cluttering the repository root. Any temporary scripts or data files should be kept in subdirectories of `vault/01_Inbox/` or similar.
- **GitNexus Codebase Intelligence**: Use GitNexus for codebase exploration, structural context query, impact analysis, designing new features, debugging issues, and locating test targets. Avoid blind grep/search when GitNexus graph tools or CLI commands (`npx gitnexus query`, `npx gitnexus impact`, etc.) can provide structured code dependencies and blast-radius analysis.
- **CI/CD & Commit Standards Alignment**: Always strictly follow the standards in `vault/20_Resources/Git Commit Standards.md` and `vault/20_Resources/CI CD Standards.md` when committing, configuring workflows, updating dependencies, or modifying test runners.


<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Qubiz** (1174 symbols, 1669 relationships, 52 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Qubiz/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Qubiz/clusters` | All functional areas |
| `gitnexus://repo/Qubiz/processes` | All execution flows |
| `gitnexus://repo/Qubiz/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
