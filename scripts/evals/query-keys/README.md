# Query-key eval

Does an agent follow the query-key conventions
(`apps/docs/docs/architecture/query-keys.md`) when nobody tells it to?

Each task is a realistic ticket for `@oppenheimer/frontend-consumer` that needs
query or mutation hooks. The ticket names the public API a real ticket would
(hook, service method, DI token) and says nothing about keys, `skipToken` or
`withCacheOnSuccess`. The agent (`claude -p`) works in a throwaway git worktree
with the repo's own `CLAUDE.md`, `AGENTS.md` and guides. `scripts/evals` is
deleted from that worktree before it starts, so it cannot read the hidden
specs or the reference answers.

```bash
node scripts/evals/query-keys/run.mjs                       # every task, the agent
node scripts/evals/query-keys/run.mjs --task host-rename    # one task
node scripts/evals/query-keys/run.mjs --model claude-opus-5-5
node scripts/evals/query-keys/run.mjs --reference           # calibration: must score 100%
node scripts/evals/query-keys/run.mjs --control             # calibration: must fail
node scripts/evals/query-keys/run.mjs --task host-rename --patch <file>   # grade a saved diff
```

`--keep` leaves the worktrees in the system temp directory for inspection, and
`--timeout <minutes>` bounds the agent (30 by default). A report with every
check, the agent's cost, turns and final message, and its diff lands in
`results/` (git-ignored). The diff in a report can be saved to a file and
re-graded with `--patch` after a spec changes, without paying for another run.

## Tasks

| Task | What the ticket asks | What it tests |
| --- | --- | --- |
| `host-rename` | `HostsService.rename`, `useRenameHost` | a mutation's cache update survives a caller `onSuccess`; the write stays narrow and leaves the minting pairing detail alone |
| `session-events` | `SessionsService.events`, `useSessionEvents(id \| undefined, page)` | a sub-resource ladder under `detail(id)`, the page as one object, `skipToken` for an unknown id |
| `projects-module` | a whole module and four hooks | the full `all → lists → list`, `details → detail` ladder, `skipToken`, and rename/archive writing the row they have |

## What is graded

In the agent's worktree, after it finishes:

- **lint**: the three Biome plugins over the files it changed, one check each.
- **build**: `pnpm --filter @oppenheimer/frontend-consumer build` (tsc).
- **tests**: the package's existing tests.
- **hidden**: `hidden/<task>.spec.tsx`, copied in only now, with
  `hidden/_harness.tsx`. One `it` per guideline, asked of a real `QueryClient`:
  what a key looks like, which factory builds it, what an invalidation
  reaches, whether a caller's `onSuccess` and the hook's cache update both ran.

The score is the share of checks passed.

## Calibration

The grader is only worth its score if it passes a correct solution and fails
the mistakes it is meant to catch, so both are in the tree:

- `reference/<task>.patch` is a solution written to the conventions.
  `--reference` must score 100%.
- `controls/<task>.<variant>.patch` is a known-bad solution: an `onSuccess`
  spread over by `...options`, an invalidation of `all`, a hand-built key with
  `enabled`, flat keys. `--control` grades each, then lists any check no
  control fails; such a check cannot catch anything yet.

The checks no control fails are the sanity gates (build, existing tests, the
export, the right service call), the lint rules that do not apply to a task's
shape, and `session-events`' "stays out of the session list", a guard against
nesting the log under `lists()`.

Edit a hidden spec, a task or a convention, and rerun both modes before
trusting an agent's score.

## Adding a task

1. Add the ticket to `tasks.json`. Name the public API the spec will drive;
   say nothing about how to key or cache it.
2. Write `hidden/<id>.spec.tsx` on the harness: one `it` per guideline, each
   driven through a real `QueryClient`. Invalidate with `refetchType: 'none'`
   where the spec itself checks reach, since an active query refetches at once
   and clears the flag.
3. Write the reference in a worktree and save `git diff` (with `git add -N`
   for new files) as `reference/<id>.patch`, then break it the ways agents do
   into `controls/<id>.<variant>.patch`.
4. Run `--reference` and `--control` until the reference scores 100% and
   every guideline check fails under some control.
