---
name: steward
description: How to drive a pull request in this repository to mergeable. CI is local, so there are no GitHub checks to wait for; a pull request carries a green `pnpm ci:local` report for its head, which whoever merges reads, and a change to what the console shows carries light and dark screenshots taken on the local stack. Use when opening, updating or watching a pull request here, or when a `main-red` issue is open.
---

# Driving a pull request here

Pull requests get no GitHub CI. `.github/workflows/ci.yml` runs
`pnpm ci:local --all` on `main`, every four hours and on demand. No GitHub
check gates a pull request: whoever merges reads the local report, and the
scheduled run is what catches a report that was wrong.

## The order

This is the one place the order is written; `local-stack`, `ship` and the
other skills point here.

1. **Edit.**
2. **Quick check:** `pnpm ci:local --dirty`. The lint job only, on the tree
   as it is, in about a minute; its report (`.ci-local/dirty-report.md`) is
   not for the pull request. Fix what it finds and run it again.
3. **Deslop:** the `deslop` skill over the branch diff.
4. **Commit**, staging files by path.
5. **Autoreview**, before the pull request is opened: the `autoreview`
   skill, a fresh agent reviewing the committed branch. Its fixes go back
   to step 2. A pull request that changes no code (a research note) skips
   it.
6. **Screens**, when the change shows on screen: the `local-stack` skill's
   "Show a visual change" (stack up `--web`, `pnpm screens <route>...`).
   An edit after them that only touches comments or layout keeps them;
   any other edit to a visual file means taking them again.
7. **`pnpm ci:local`** on that commit. A stack already up with `--web` stays
   up; the run swaps in the API it built.
8. **Push** on green, with the report, the autoreview and the screenshots
   in the description.

A fix after step 7 goes back to step 2 for that fix, and through 4–8 again;
once the pull request is open, step 5 runs again only for a fix that
changes behavior.

## Before every push

1. Commit, then run `pnpm ci:local`. It refuses uncommitted changes and
   untracked files, checks what the branch touches against `origin/main`, and
   brings the local stack up (Docker, Postgres, Redis, the API built from this
   commit) when the integration or e2e suite is selected. Stop your own dev
   API first: it refuses an API on the port that the stack did not start. A
   change to a file no package owns (the workflow, the lockfile, the CI
   scripts) selects everything on its own; a repo check the lint job runs,
   an eval's cases, or `apps/web/bundle-budget.json` does not
   (`scripts/ci/selection.mjs`). The jobs run side by side and the first
   failure stops the run; `--no-fail-fast` finishes every job, and each
   step's output is in `.ci-local/logs/`.
2. Push only on a green run. A red step is yours to fix. Never skip a job
   with `--skip` to get green; `--skip` exists for re-running a job you have
   just fixed.
3. Put `.ci-local/report.md` in the pull request's description, under a
   `## Local CI` heading. Replace it after each push, so the report always
   names the head commit.

4. If the branch changes what the console shows (as
   `.agents/hooks/visual-change.mjs` defines it), take its screenshots with the `local-stack`
   skill ("Show a visual change") before you push: light and dark, every
   route the change shows on. Look at each one, send them to the user, and
   give the description a `## Screenshots` section naming the routes,
   themes, widths and the commit they were taken on. A change there that is
   not visual says why in that section instead (`pnpm screens --not-visual
   "<why>"` records it). Take them again after a change to how it looks.
   `.agents/hooks/screenshot-guard.mjs` refuses the push and the pull
   request's creation or update until the pictures are of the code as it is.

A pull request is ready when the report's commit is its head, every row is
green, a visual change has its screenshots, and every review thread has an
answer. There is nothing to wait for
on GitHub: do not poll for checks, and do not push an empty commit to start
one.

## Merging

Every pull request an agent opens carries one of three labels. The label
is the protocol: it says what the pull request waits for, and who merges.

| Label | Started by | Waits for | Merged by |
| --- | --- | --- | --- |
| `ship` | `/ship` (a fix) | ready, and a `PASS` from a fresh agent that did not write it | the agent, on its own |
| `propose` | `/propose` (a change Jordi signs off: a feature, a refactor, a fix he wants to see) | the same, and Jordi accepting it: `/ship`, or swapping the label to `ship` | the agent, once accepted |
| `research` | `/research` (a note or a proof of concept) | ready | the agent, as soon as it is green |

`/cook` picks one of the three for a task and says which (when it runs: `AGENTS.md`, "Hard rules"). A pull request with none of them merges only when Jordi says so. A review
is never an approval: the bot reviews post from Jordi's account. The
lanes are the `ship`, `propose` and `research` skills; all three merge
through `ship` step 4, which also resolves conflicts with the target.

## Babysitting

A pull request an agent opened stays mergeable until it merges or closes;
its session owns it. On every event and every check-in, fetch it fresh and
work, in this order:

1. **Conflict**, or behind a base that must be current. Merge
   `origin/<base>` into the branch (never rebase or force-push). Resolve
   each conflict by reading both sides and the commits behind them
   (`git log --merge -p <file>`): keep what each side meant, not one side
   wholesale. Lockfiles and generated files are never hand-merged: take
   either side and regenerate them with their tooling (`pnpm install`,
   `pnpm generate:api-client`, the router's generator,
   `pnpm generate:guide`, `product/brief.html` from its notes). A
   conflict that needs a product call (both sides changed the same
   behavior, or one deleted what the other built on) goes to Jordi with
   the file, both sides in a sentence each and your default; the merge
   stays uncommitted until he answers. Commit it staging files by path,
   then the steps below for the new head.
2. **Review comments.** Verify each against the code. Fix what is real and
   reply with the commit; answer the rest with the reason it stays. Resolve
   every thread you answered. A comment that asks for more than the task
   goes to Jordi.
3. **Report.** After any push, `pnpm ci:local` on the new head and replace
   the report. Code that changed needs its verdict again (and its
   screenshots, for a visual file), including a conflict resolution that
   changed behavior; a plain merge of the base does not.

Keep one check-in armed about every four hours while it is open, so a
conflict from another merge is caught without an event; every hour once
nothing but the merge is left (`ship` step 4). When nothing is
left to do, say once what it waits for, then stay quiet until something
changes.

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
