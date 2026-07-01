# Agent Rules and Guidelines

- **Divide et Impera**: Split all complex tasks into smaller, manageable subtasks.
- **Use Subagents**: For any substantial task, define and invoke specialized subagents (e.g. for reading files, writing code, executing tests, or doing research) to maintain context clarity and clean workspace separation.
- **Test-Driven Alignment**: You are not allowed to modify tests unless you are adding new features. You must never modify existing tests to accommodate code changes; the application features must adapt to the tests, not the other way around.
