---
name: steward
description: How to drive a pull request in this repository to mergeable. CI is local, so there are no GitHub checks to wait for; the gate is a green `pnpm ci:local` report for the pull request's head. Use when opening, updating or watching a pull request here, or when a `main-red` issue is open.
---

# Driving a pull request here

Pull requests get no GitHub CI. `.github/workflows/ci.yml` runs only on `main`,
every eight hours and on demand. The gate for a pull request is the local run.

## Before every push

1. Run `pnpm ci:local`. It checks what the branch touches against
   `origin/main` and starts Docker and the local stack when the API is
   affected. Pass `--all` when the change touches a file no package owns
   (the workflow, the lockfile, `scripts/`); it does that on its own when it
   can tell.
2. Push only on a green run. A red step is yours to fix. Never skip a job
   with `--skip` to get green; `--skip` exists for re-running a job you have
   just fixed.
3. Put `.ci-local/report.md` in the pull request's description, under a
   `## Local CI` heading. Replace it after each push, so the report always
   names the head commit.

A pull request is ready when the report's commit is its head, every row is
green, and every review thread has an answer. There is nothing to wait for
on GitHub: do not poll for checks, and do not push an empty commit to start
one.

## After a merge from main

A merge of `origin/main` into the branch is a new head. Run `pnpm ci:local`
again before you push it, and replace the report.

## When main is red

The scheduled run opens a `main-red` issue with the failing jobs and the
run's link, and the next green run closes it. When one is open:

- A failure the issue names is not your pull request's. Say so once on the
  pull request, and keep your own report green against `origin/main`.
- If you are the session asked to fix it, check out the commit the issue
  names, reproduce it with `pnpm ci:local --all`, and fix it in its own pull
  request that links the issue. "Flake" is not a root cause: stress the test
  under load (`go test -count=300 -cpu 1`, or the Vitest equivalent) until it
  fails, then fix the race.
