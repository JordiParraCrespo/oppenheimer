# Query-key eval

Does an agent follow the query-key conventions
(`apps/docs/docs/architecture/query-keys.md`) when nobody tells it to? A task
in `tasks.json` is a ticket that names the hook to add and says nothing about
keys. `claude -p` does it in a throwaway worktree with `scripts/evals` removed.
The grader then runs the Biome plugins the task names, the consumer build and
tests, and `hidden/<task>.spec.tsx` against a real `QueryClient`.

```bash
node scripts/evals/query-keys/run.mjs [--task <id>] [--model <id>]   # the agent
node scripts/evals/query-keys/run.mjs --reference   # must score 100%
node scripts/evals/query-keys/run.mjs --control     # every guideline check must fail under some control
node scripts/evals/query-keys/run.mjs --task <id> --patch <file>     # re-grade a saved diff
```

`reference/<task>.patch` is a correct solution. `controls/<task>.<variant>.patch`
is a small known-bad change applied on top of it. Reports go to `results/`
(git-ignored). This is not a CI job: each agent run costs tokens.
