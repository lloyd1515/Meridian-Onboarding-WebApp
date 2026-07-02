# Agent Rules and Guidelines

- **Divide et Impera**: Split all complex tasks into smaller, manageable subtasks.
- **Use Subagents**: For any substantial task, define and invoke specialized subagents (e.g. for reading files, writing code, executing tests, or doing research) to maintain context clarity and clean workspace separation.
- **Test-Driven Alignment**: You are not allowed to modify tests unless you are adding new features. You must never modify existing tests to accommodate code changes; the application features must adapt to the tests, not the other way around.
- **Obsidian Vault Organization**: Maintain the structured Obsidian vault located at `vault/` using the PARA method:
  - `vault/01_Inbox/` for quick capture, ideas, temporary notes, and unclassified logs.
  - `vault/10_Projects/` for active project blueprints and implementation plans.
  - `vault/20_Resources/` for static guidelines, specifications, standards, and research.
  - `vault/30_Archive/` for completed, inactive, or historical logs/notes.
  - `vault/40_Canvas/` for visual charts, architectural maps, and canvas diagrams.
- **Artifacts and Scratch Files**: Put all conceptual/technical notes, architectural blueprints, ideas, and generated code artifacts directly into the appropriate vault folder instead of cluttering the repository root. Any temporary scripts or data files should be kept in subdirectories of `vault/01_Inbox/` or similar.

