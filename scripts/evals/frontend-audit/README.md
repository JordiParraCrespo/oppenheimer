# Frontend-audit eval

Does `/frontend-audit` find a rule break a day's merge brings in, and stay
quiet about code that only looks like one? The skill is the prompt the daily
routine runs, so this is how a change to it gets measured before it ships.

A case in `cases.json` is a small change to `apps/web`: the files under
`cases/<id>/`, laid over the repo at their own paths and committed on top of
HEAD in a throwaway worktree. The auditor then runs exactly what the routine
runs, in diff mode against the commit before the case, with `scripts/evals`
removed so the expectations are out of its reach. Nine cases plant one break
each. Three decoys are the same kind of code done right: a tick kept in the
leaf that shows it, a debounced search, and an effect that names its system.

```bash
node scripts/evals/frontend-audit/run.mjs --validate        # the fixtures, no agent: must be 12/12
node scripts/evals/frontend-audit/run.mjs [--case <id>]     # the agent (default claude-sonnet-5)
node scripts/evals/frontend-audit/run.mjs --trials 3        # each case three times
node scripts/evals/frontend-audit/run.mjs --grade <report>  # re-grade a saved report
```

`--validate` proves each fixture tests the prompt rather than a script: every
case typechecks, and the mechanical checks (`check:structure`, `arch`, Biome,
`lint:design`, `check:compiler`) fail only where the case's `mechanical` field
says they should. `cross-feature-import` is there to fail `pnpm arch`, and
the audit has to report the check's failure rather than re-derive it.

Grading:

- **recall**: every expected finding, meaning its rule or an accepted
  alternative on its file, appears in the skill's JSON block.
- **noise**: a `medium` or `high` finding on a case file that no expectation
  names. Rules in `tolerate` (a missing render budget, a missing e2e spec) are
  fair on any new file and count for nothing either way. Findings on files
  outside the change are counted, not scored: they are the codebase's.
- A case passes with full recall and no noise. A decoy passes with no noise.

The fixtures are whole files, not patches, so they survive edits to the
files around them. A fixture that stops typechecking after an API change
shows up in `--validate`, and the fix is to update the fixture. Reports go to
`results/` (git-ignored). This is not a CI job: every agent run costs tokens.
