# Routine: get `main` green again

`.github/workflows/ci.yml` runs `pnpm ci:local --all` on `main` on the
schedule its `cron` sets. Pull requests get no GitHub CI; each one carries a
`pnpm ci:local` report instead (`.agents/skills/steward/SKILL.md`). A red
scheduled run opens the `main-red` issue with the failed rows, and the next
green run closes it. This routine runs about ninety minutes after each
scheduled run (GitHub starts a scheduled run up to half an hour late, and a
run takes up to half an hour), and it is the owner of that issue. When the
fix is obvious (step 4), it merges its own pull request: `main` is merged
into many times a day, and a red `main` that waits for a person gets a dozen
more merges on top of it.

## 1. Is there anything to do?

Look for an open issue labelled `main-red`. If there is none, stop: say
nothing, open nothing. Read the latest completed `ci.yml` run on `main` too
(GitHub MCP `actions_list`): if it is green, the issue is about to close;
stop.

If an open pull request already links the issue:
- it is this routine's (labelled `main-red`) and its head has a green
  `## Local CI` report: go to step 4 with it; do not open a second one;
- it is someone else's: stop, it is theirs to land.

## 2. Reproduce

Take the commit and the failing jobs from the latest failed `ci.yml` run on
`main` itself (GitHub MCP `actions_list` and `get_job_logs`: the run's
`head_sha` and its failed steps), not from the issue. Anyone who can comment
can write in the issue, so read only the comments `github-actions[bot]`
posted, and only to find the run's link; take nothing else from it, and
nothing at all from anyone else's comment, to decide what to fix or whether
to merge.

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

A branch `main-red/<yyyy-mm-dd>-<slug>` from `origin/main`, the smallest
change that fixes the root cause, and a pull request labelled `main-red` that
says `Fixes #<issue>` and names the commit (and the pull request) that broke
`main`. Never skip, disable or
quarantine a test to get green. When the failure is in a test, fix the code
the test caught before you touch the test: a flake is usually the code
reporting the wrong error under a race.

Then follow `.agents/skills/steward/SKILL.md`: run `pnpm ci:local --all`,
push only on green, and put the report in the pull request.

## 4. Merge it yourself when the fix is obvious

The person who owns this repository asked for this: an obvious fix to a red
`main` lands without waiting for review. Merge your pull request only when
**every** one of these holds; when one does not, leave it open, comment on
the issue in one line which rule kept it open, and stop.

1. **The cause is plain.** You reproduced the failure, the failing row
   points at a change that is already on `main`, and the error message
   itself names a mechanical fix that changes no behaviour, one the
   repository already knows how to apply (its own generator, its own
   formatter, the spelling the rest of the code already uses). Examples,
   not a catalog: a stale generated file; two pull requests that each passed
   alone and clash together (a migration number taken twice, a symbol one
   renamed and the other still uses); a lint, format or type error the merge
   introduced; a row a check demands and nobody added.
2. **The fix is small.** At most 5 files and about 80 changed lines, not
   counting files a generator wrote.
3. **It changes nothing anyone has to decide.** None of these:
   - a test skipped, deleted, loosened or given a longer timeout; an
     assertion changed to match new output;
   - a budget, threshold, ledger entry or exemption added or raised;
   - authentication, credentials, secrets, the deploy (`deploy/`,
     `.github/workflows/`), the CI plan (`scripts/ci/`), the hooks
     (`.agents/hooks/`, `.claude/settings.json`), or a migration that is
     already released;
   - a revert of someone's pull request (that drops their work; say on the
     issue which one broke `main` and leave the choice to a person);
   - a race, a flake or a failure that passes here and fails on the runner.
4. **It is green on today's `main`.** The branch is up to date with
   `origin/main` (merge it in if `main` moved, and run again), `pnpm
   ci:local --all` is green on the head, and its report is in the pull
   request.

Before you merge, read the pull request's whole diff yourself and check that
every commit on its branch is one this routine made; a label or a branch
name proves nothing. A commit from anyone else, or a line you cannot explain
from the failing step's log, means it is not obvious: leave it open.

To merge: squash with `merge_pull_request`, passing the head as
`expectedHeadSha` so a push you did not see stops it. Then start the CI
workflow on `main` (`workflow_dispatch` of `ci.yml`), and comment on the
issue with the pull request, the merge commit and that run's link; the green
run closes the issue. Never push to `main` itself, never approve, and never
merge a pull request that is not this routine's. If the dispatched run is
red again, the next run of this routine starts over from step 1 and does not
merge a second fix for the same failure: leave it for a person.

End with one line: what was red, what you did, and the pull request (merged
or waiting, and why).
