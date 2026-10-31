# PR-screenshots eval

Does an agent that changes what the console shows take screenshots of it on
the local stack, look at them and put them in its pull request, without
being asked to? And does it leave a change that is not visual alone? The
rule lives in `AGENTS.md`, the `local-stack` and `steward` skills,
`.agents/rules/frontend-ui.md` and the PreToolUse hook
`.agents/hooks/screenshot-guard.mjs`, which refuses a push or a pull request
without them. This measures that they work together,
and `--ref` measures the same tasks against the rules before them.

A case in `cases.json` is a task, worded the way a person would ask for it,
with no mention of screenshots. The agent gets it in a throwaway clone of
`--ref` (default `HEAD`) with `scripts/evals` deleted and an origin that
refuses every push. It does the change, commits, and writes the pull request
it would open to `PR.md`. Three cases are visual: a copy change in the
translations, a layout bug at phone width, and a design-system change that
shows only where a Card renders. Two are decoys: an API-only test, and an
`apps/web` change that is only a unit test.

```bash
node scripts/stack/stack.mjs down                               # the eval stands up its own
node scripts/evals/pr-screenshots/run.mjs                       # every case on HEAD (default claude-sonnet-5-5)
node scripts/evals/pr-screenshots/run.mjs --ref origin/main     # the baseline
node scripts/evals/pr-screenshots/run.mjs --case settings-phone --trials 3
node scripts/evals/pr-screenshots/run.mjs --grade <report>      # re-grade a saved report
```

It needs what `stack.mjs up --web` needs: Postgres and Redis listening (or
Docker to start them), and Chromium (`PLAYWRIGHT_CHROMIUM_PATH` where the
machine ships one). Ports 3000 and 3001 must be free.

Grading reads the clone and the agent's transcript:

| Signal | Means |
| --- | --- |
| `stack` | it ran `stack.mjs up --web` |
| `shots` | PNGs it left in the clone, light and dark, are of the code it ended with: the manifest's fingerprint matches its change (`.agents/hooks/visual-change.mjs`, the guard's own) |
| `looked` | it read at least one PNG |
| `section` | `PR.md` has a `## Screenshots` section |
| `committed` | it committed the change |
| `skill` | it invoked the `local-stack` skill (reported, not required) |

A visual case passes with `stack`, `shots`, `looked`, `section` and
`committed`. A decoy passes when it took no screenshots, did not start the
console, committed, and wrote `PR.md`. Reports go to `results/`
(git-ignored), written after each case so a long run can be read while it
goes. This is not a CI job: every case is a full agent run against a real
stack, several minutes and a few dollars each.
