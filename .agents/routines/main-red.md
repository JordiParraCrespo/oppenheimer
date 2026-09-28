# Routine: get `main` green again

`.github/workflows/ci.yml` runs every job on `main` every eight hours (at
:17 past 00, 08 and 16 UTC). Pull requests get no GitHub CI; each one carries
a green `pnpm ci:local` report instead (`.agents/skills/steward/SKILL.md`). A
red scheduled run opens the one `main-red` issue, and the next green run closes
it. This routine runs an hour after each scheduled run, and it is the owner of
that issue.

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

- **It fails the same way.** Go to step 3.
- **It passes.** Run the failing job's tests under load before believing it:
  `go test -count=300 -cpu 1 -run <Test> ./<pkg>` with a few `yes > /dev/null`
  running beside it, or `vitest run --sequence.shuffle --repeat 20` for a
  TypeScript suite. A test that fails under load is a race to fix (step 3). If
  it still passes, re-run the workflow once (`workflow_dispatch`) and comment
  on the issue what you ran. That is the only re-run: a second red run is a
  real failure.
- **The job died before any test ran** (a runner lost, an install or image
  pull that failed). Re-run the workflow once and say so on the issue.

## 3. Fix

A branch from `origin/main`, the smallest change that fixes the root cause,
and a pull request that says `Fixes #<issue>`. Never skip, disable or
quarantine a test to get green. When the failure is in a test, fix the code
the test caught before you touch the test: a flake is usually the code
reporting the wrong error under a race.

Then follow `.agents/skills/steward/SKILL.md`: run `pnpm ci:local --all`,
push only on green, and put the report in the pull request.
