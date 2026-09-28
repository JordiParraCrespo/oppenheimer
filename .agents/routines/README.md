# Routines

Prompts that a scheduled Claude Code routine runs, versioned here so a change
goes through review like code does. The routine's own prompt (set in
claude.ai → Routines) only points at the file here, so editing the file is how
you change what the routine does.

| Routine | Schedule | What it does |
| --- | --- | --- |
| [`hexagon-audit.md`](hexagon-audit.md) | daily, 07:50 Europe/Madrid | Audits `apps/api` against its Domain-Driven Hexagon contract. Keeps one `hexagon-audit` issue current and opens a small fix PR for the blocking findings it is sure about. |
| [`main-red.md`](main-red.md) | one hour after each scheduled CI run (the `cron` in `.github/workflows/ci.yml`) | Owns the `main-red` issue the scheduled CI run opens: reproduces the failure with `pnpm ci:local --all`, and opens the pull request that fixes the root cause. Does nothing when `main` is green. |

Each routine has evals under `evals/<routine>/`. Run them when you change the
prompt, or the rules it enforces.
