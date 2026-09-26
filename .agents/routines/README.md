# Routines

Prompts that a scheduled Claude Code routine runs, versioned here so a change
goes through review like code does. The routine's own prompt (set in
claude.ai → Routines) only points at the file here, so editing the file is how
you change what the routine does.

| Routine | Schedule | What it does |
| --- | --- | --- |
| [`hexagon-audit.md`](hexagon-audit.md) | daily, 07:50 Europe/Madrid | Audits `apps/api` against its Domain-Driven Hexagon contract. Keeps one `hexagon-audit` issue current and opens a small fix PR for the blocking findings it is sure about. |

Each routine has evals under `evals/<routine>/`. Run them when you change the
prompt, or the rules it enforces.
