# Routine: get `main` green again

`.github/workflows/ci.yml` runs `pnpm ci:local --all` on `main` on the
schedule its `cron` sets. Pull requests get no GitHub CI; each one carries a
`pnpm ci:local` report instead (`.agents/skills/steward/SKILL.md`). A red
scheduled run opens the `main-red` issue with the failed rows, and the next
green run closes it. This routine runs an hour after each scheduled run, and it
is the owner of that issue.

## 1. Is there anything to do?

Look for an open issue labelled `main-red`. If there is none, stop: say
nothing, open nothing. If an open pull request already links the issue and
its head has a green `## Local CI` report, stop as well; it is waiting on a
merge, not on you.

## 2. Reproduce

The issue's latest comment names the commit and the failing jobs.

```bash
git fetch origin main && git checkout --detach <commit>
pnpm install --frozen-lockfile
pnpm ci:local --all
```

The scheduled run ran this same command, so it should fail the same way;
go to step 3.

When it passes here, the difference is the machine, not the program, and
that difference is the bug to find. Read the failing step's log in the run,
then look for what the runner has and this checkout does not: load (run the
failing test under it, `go test -count=300 -cpu 1 -run <Test> ./<pkg>` with a
few `yes > /dev/null` beside it, or `vitest run --repeat 20`), a service
already listening, an environment variable the runner defines. A test that
fails under load is a race in the code to fix in step 3. Re-run the workflow
(`workflow_dispatch`) only when the job died before any step of `ci:local`
ran (a lost runner, an install that failed), and say so on the issue.

## 3. Fix

A branch from `origin/main`, the smallest change that fixes the root cause,
and a pull request that says `Fixes #<issue>`. Never skip, disable or
quarantine a test to get green. When the failure is in a test, fix the code
the test caught before you touch the test: a flake is usually the code
reporting the wrong error under a race.

Then follow `.agents/skills/steward/SKILL.md`: run `pnpm ci:local --all`,
push only on green, and put the report in the pull request.
