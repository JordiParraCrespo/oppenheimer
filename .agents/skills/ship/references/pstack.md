# How pstack drives a pull request

A read of poteto's pstack (`cursor/plugins`, `pstack/` at `9580c23`,
2026-10-23), the Cursor plugin `correct` was adapted from. What it does from
"the code is written" to "it is on `main`", what `ship` took from it, and
what it left.

## The flow

pstack splits the work after the code into four playbooks under
`skills/poteto-mode/playbooks/`, each ending where the next begins:

1. **Opening a PR** (`opening-a-pr.md`). From a worktree off `main`: small
   ordered commits (rebased, each one landable), `/deslop` over the diff,
   `/no-comments`, a description with fixed headings (Why, What changed,
   Scope, Tradeoffs, Blast Radius, Verification) of about a minute's read,
   opened ready, never draft. Opening a PR does **not** start a babysit.
2. **Babysit** (`babysit.md`). Starts only when asked, once the whole stack
   is built. Declares a mode first (`drive` to merge-ready, `background`,
   `threads-only`, `check` for one status pass). Works the lowest unmerged
   PR only. Order: conflicts, then review threads, then CI, every known fix
   in one push. CI is classified before any retry: one fresh build for a
   flake, an identical second failure is real. Bot comments are triaged
   `fix` / `dismiss` / `ask` against a shared rubric
   (`references/bugbot-triage.md`) that grows a pattern each time a
   dismissal recurs; security, auth, billing, data and migrations are always
   `ask`. It is event-driven: a bundled watcher (`scripts/watch-pr/`) polls
   GitHub and emits a verdict (`READY`, `WAITING`, `ADVANCE`, `COMPLETE`)
   that wakes the loop, never a second sleep loop. **Babysit never merges.**
3. **Shipping** (`shipping.md`). "Green is not safe." Before anything lands,
   one fresh agent per PR, one that did not write the code, runs the change
   the way a user would (`control-ui`, `control-cli`) parent against head
   and posts `PASS`, `PASS+NOTES` or `FAIL`. Green CI and an approving bot
   review are not verdicts. Only the contiguous verified run from the bottom
   of the stack lands, one PR at a time. A verdict covers a patch, not a
   SHA: after a rebase, `git patch-id` decides whether it still holds. A
   merge is read back, because a queued merge or an armed auto-merge is not
   a merge.
4. **Autopilot-full / Autopilot-stack** (`autopilot-*.md`). For a queue left
   overnight. One owner agent per PR builds, opens, babysits and merges it;
   the root never writes code, only verdicts. A **swarm** of fresh verifiers
   checks the code-ready head once (gates re-run, live proof on the real
   surface, diff audit); a rebase or a small fix after that gets one
   verifier, only new behavior gets the full swarm again. Anything that
   loosens a gate (a raised budget, an allowlist entry) needs the root's
   countersign. Autopilot-stack ships nothing: you wake to a verified stack
   and land it yourself.

Around them: **Bug fix** (`bug-fix.md`) reproduces on the real surface
first and stages the failing repro before the fix in history;
`/create-verification-skill` writes a repo's `verify-<app>` skill (Launch,
Doctor, Drive, Evidence, Cleanup, and a feature map) and proves it once end
to end; `/maintain-verification-skill` keeps that map honest daily;
`/show-me-your-work` keeps a decision log for a run nobody watched;
`/ketchup` catches the operator up with each call waiting on them.

## What `ship` took

- **The author never verifies its own merge.** `verify-pr`
  (`.claude/workflows/verify-pr.js`) is Shipping's per-PR verifier plus
  Autopilot's swarm: gates, a live lane on `local-stack`, three audit lenses,
  and a skeptic per finding. Same verdict words, plus `BLOCKED` for a lane
  that could not run, because a missing lane is not a pass.
- **A verdict covers a patch.** The `git patch-id` rule decides whether a
  merge of `main` keeps the verdict.
- **A fix reproduces first**, and the live lane checks the repro fails on
  `main` and passes on the head.
- **Reviews are not verdicts.** This repo's bot reviews post from Jordi's
  own account, so the old `ship` gate ("a submitted review from a user
  account") passed on a bot; it is gone. Acceptance for a feature is Jordi
  saying so or the `accepted` label.
- **Read the merge back** before reporting it.

## What `ship` left, and why

- **Stacks, the merge frontier, Origin and Graphite.** This repo opens
  independent PRs off `main`; there is no stack to walk.
- **Babysit's watcher.** Claude Code sessions here already wake on GitHub
  events (`subscribe_pr_activity`) and arm their own check-ins; a poller
  would be a second loop.
- **pstack never auto-merges on green alone, and neither does `ship`**; but
  pstack never merges without an explicit "land it" either. `ship` merges a
  `fix` on the verdict, because Jordi asked for that. The guard is the lane:
  a fix that adds behavior, touches a sensitive path or needs a decision is
  a feature.

## Worth taking next

- A shared bot-triage rubric like `bugbot-triage.md`, for the Grok and
  Claude Code Review comments: recurring dismissals become patterns instead
  of being re-argued per PR.
- A `verify-oppenheimer` feature map in the `local-stack` skill (one file
  per console feature: how to reach it, how to drive it, what proves it), so
  the live lane covers every entry point, not the convenient one.
- `/ketchup`-style status: one message listing every PR waiting on Jordi,
  with its verdict and the one thing to look at.
