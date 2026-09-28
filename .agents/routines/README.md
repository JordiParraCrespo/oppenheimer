# Routines

Prompts that a scheduled Claude Code routine runs, versioned here so a change
goes through review like code does. The routine's own prompt (set in
claude.ai → Routines) only points at the file here, so editing the file is how
you change what the routine does.

| Routine | Schedule | Prompt | What it does |
| --- | --- | --- | --- |
| Daily hexagon audit | daily, 05:20 Europe/Madrid | [`hexagon-audit.md`](hexagon-audit.md) | Audits `apps/api` against its Domain-Driven Hexagon contract. Keeps one `hexagon-audit` issue current and opens a small fix PR for the blocking findings it is sure about. |
| Frontend audit | daily, 05:16 Europe/Madrid | `/frontend-audit routine` ([the skill](../skills/frontend-audit/SKILL.md), "Routine mode") | Audits `apps/web` and `packages/frontend/*` against the frontend rules, the re-renders the React Compiler does not prevent included. Keeps one `frontend-audit` issue current and one `frontend-audit/fix-<date>` PR for the findings it is safe to fix. |

Both write to one GitHub issue, and that issue is the run's output: a run
that cannot reach GitHub says so instead of finishing quietly. Days with no
issue on GitHub mean the routine is broken, not that the code is clean; open
the run's session from claude.ai → Routines and read why.

Each routine has evals. The hexagon audit's are under `evals/<routine>/`; the
frontend audit's are `scripts/evals/frontend-audit/`, whose `--validate` proves
the fixtures still typecheck against the current code without an agent. Run
them when you change the prompt, or the rules it enforces, and after a
refactor that moves the code the fixtures anchor on:
`plant.mjs` fails loudly when an anchor is gone, and `--validate` when a
fixture no longer compiles.
