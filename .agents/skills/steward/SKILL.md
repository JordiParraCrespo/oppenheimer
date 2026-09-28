---
name: steward
description: How to drive a pull request in this repository to mergeable. CI is local, so there are no GitHub checks to wait for; a pull request carries a green `pnpm ci:local` report for its head, which whoever merges reads. Use when opening, updating or watching a pull request here, or when a `main-red` issue is open.
---

# Driving a pull request here

Pull requests get no GitHub CI. `.github/workflows/ci.yml` runs
`pnpm ci:local --all` on `main`, every eight hours and on demand. No GitHub
check gates a pull request: whoever merges reads the local report, and the
scheduled run is what catches a report that was wrong.

## Before every push

1. Commit, then run `pnpm ci:local`. It refuses uncommitted changes and
   untracked files, checks what the branch touches against `origin/main`, and
   brings the local stack up (Docker, Postgres, Redis, the API built from this
   commit) when the integration or e2e suite is selected. Stop your own dev
   API first: it refuses an API on the port that the stack did not start. A change to a file no package owns (the workflow, the lockfile,
   `scripts/`) selects everything on its own.
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
- If you are the session asked to fix it, follow
  `.agents/routines/main-red.md`.
