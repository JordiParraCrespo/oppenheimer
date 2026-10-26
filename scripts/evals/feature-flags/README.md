# Feature-flag eval

Does an agent that launches a feature behind a flag launch it **on**? Every
boolean flag defaults to `true` (`.agents/rules/feature-flags.md`): a feature
ships on for everyone, and its flag is how it is turned off or narrowed.
`pnpm check:flags` fails a boolean flag that defaults to `false`.

A task in `tasks.json` is a ticket that asks for a feature behind a new flag
and says nothing about the default. Each is worded the way people talk when
they would once have reached for `false`:

- `host-copy-id`: a console action "we were not sure people want", behind a
  flag "we can switch off for a workspace" (client only).
- `host-timeline-beta`: an endpoint "still in beta", server only.
- `session-rename-rollout`: "roll it out gradually, starting with our own
  workspace", in the API and the console.

`claude -p` does each in a throwaway worktree of `--ref` with `scripts/evals`
removed. The grader then reads the catalog before and after, and checks:

| Group | Check |
| --- | --- |
| catalog | the change adds a flag |
| **default** | **every new boolean flag defaults to `true`** (the headline: "launched on") |
| existing | no flag already in the catalog had its default changed |
| reads | the new flag is read where the ticket gates it (`useFeatureFlag` in the console, `@RequireFlag`/`isEnabled` in the API), and goes to clients only if the console reads it |
| checks | `pnpm check:flags`, with the grader's own copy of the script |
| build | `@oppenheimer/shared` builds; `@oppenheimer/web` and/or `@oppenheimer/api` typecheck |

```bash
node scripts/evals/feature-flags/run.mjs [--task <id>] [--model <id>]   # the agent
node scripts/evals/feature-flags/run.mjs --trials 3                     # each task three times
node scripts/evals/feature-flags/run.mjs --ref <commit>                 # the agent against other rules
node scripts/evals/feature-flags/run.mjs --reference    # must score 100%
node scripts/evals/feature-flags/run.mjs --control      # every check must fail under some control
node scripts/evals/feature-flags/run.mjs --task <id> --patch <file>     # re-grade a saved diff
```

`reference/<task>.patch` is a correct solution. `controls/<task>.<variant>.patch`
is a small known-bad change applied on top of it: a new flag off by default,
an existing flag switched off, a flag nothing reads, a server-only flag put
on the wire, a catalog that does not typecheck, no flag at all. The run ends
with "Launched on n/m", the tasks whose new flags all default to `true`.
Reports go to `results/` (git-ignored). This is not a CI job: each agent run
costs tokens.
