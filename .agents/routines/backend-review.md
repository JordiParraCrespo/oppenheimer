# Routine: weekly review of the backend and the harness, with a pull request per finding

Every week you review what the hexagon audit does not: what is slowing pull
requests down, what is starting to strain in the backend, and what is wrong on
the critical path. You keep one GitHub issue current, and you open one pull
request for each finding you can fix with confidence.

This is a measured review. A finding has a number behind it (a timing, a
count, a `file:line` traced end to end), not an impression. The hexagon audit
(`hexagon-audit.md`) already polices the module contract, so a contract
violation is not a finding here unless it causes one of the problems below.

## Arguments

- `--dry-run <path>`: write the report to `<path>` and do not touch GitHub.
- `--no-fix`: update the issue, open no pull requests.

## 1. Prepare

```bash
git fetch origin main && git checkout --detach origin/main
pnpm install --frozen-lockfile
```

Read the root `AGENTS.md`, `apps/api/ARCHITECTURE.md`, `.agents/skills/steward/SKILL.md`,
and the rules under `.agents/rules/` that cover the code you review. Read the
open issue labelled `backend-review`, if there is one: its findings, and the
pull requests linked from it.

## 2. Measure

Write each number down; the report quotes it next to the previous week's.

- **Where pull requests wait.** Take the pull requests merged in the last 7
  days (GitHub MCP `list_pull_requests`). Record:
  - median and worst time from open to merge;
  - the `## Local CI` table of three of them, with its per-job times;
  - the commits whose only job was to repair a clash with `main` (a migration
    renumbered, a budget raised, a generated file regenerated, a merge of
    `main`).
- **Local CI.** Run `pnpm ci:local --all` and keep `.ci-local/report.md`. Name
  the three slowest rows.
- **API unit tests.** Run `npx vitest run --reporter=json` in `apps/api`.
  Compare the wall time with the sum of the test bodies. Name the slowest files
  and any test that waits on the real clock.
- **Size and coupling.** For each `apps/api/src` module, record lines of code,
  number of handlers, largest file, and how many distinct classes it imports
  from other modules. Record every non-migration file over 500 lines.
- **Harness cost.** Record:
  - the word count of the root `AGENTS.md`;
  - the words of the rules that load for an `apps/api` edit and for an
    `apps/web` edit;
  - the time of each hook in `.claude/settings.json`, run on a sample input.

## 3. Review

Look for these in what changed since the last run
(`git log --since='8 days ago' origin/main`), and in the strain points the
measurements name. Split the review across subagents, at most four, one per
area. Each subagent gets the measurements and the area, not your
conclusions.

- **Critical path:** `relay`, `links`, `hosts`, and how `sessions` move through
  their lifecycle. Look for races, retries that never come, unbounded
  buffers, sockets with no heartbeat, and authentication. Read
  `product/versions/mvp/01-protocol.md` first.
- **Security coverage:**
  - routes without authentication, scope, policy or throttling that the
    route meta-tests under `apps/api/src/__tests__/` do not catch;
  - outside calls that bypass `UpstreamLimiter`;
  - reads by id with no workspace filter.
- **Structure:** code copied between modules, modules that every new feature
  has to touch, mappers or repositories doing a domain's job, paging with no
  limit, concurrency styles that differ from the default in
  `.agents/rules/typeorm.md`.
- **Speed and harness:**
  - CI routing (`scripts/ci/affected.mjs`, `turbo.json` caching);
  - hooks that cost seconds on every turn;
  - rules and skills that are stale, contradict each other, or load where
    they do not apply;
  - recurring clash commits from step 2.

A finding states:
- what is wrong, and a concrete scenario where it breaks or costs time;
- the evidence (`file:line` or the measurement);
- whether you **confirmed** it (traced the path, or reproduced it) or it is
  only **plausible**;
- the fix, and its size (S, M or L).

Before you keep a finding, check it against the code yourself. Drop any
finding that:
- an open pull request already fixes;
- a person declined in the issue;
- you cannot back with evidence.

## 4. Report

Find the open issue labelled `backend-review`. If there is none, create the
label, then the issue `Backend review: open findings`. Do not use
`backend-review` on anything else.

- The **body** holds the current state:
  - a checklist of every open finding, grouped by area, each with its
    evidence, verdict and size, and the pull request that fixes it when there
    is one;
  - the measurements table, this week against last week.
- Tick a finding when its pull request is merged.
- Remove a finding the code no longer has, and say so in that day's comment.
- Each run adds one **comment** with the date, the base commit, what is new,
  what was fixed, and the pull requests opened.

Never @-mention anyone and never assign. Findings that are a person's
decision (a merge policy, a product question, dropping a feature) go in a
"Needs a decision" section, never into a pull request.

## 5. Fix: one pull request per finding

Skip this step under `--no-fix`. Every **confirmed** finding of size S or M
gets a pull request, unless one of these holds:
- an open pull request for it already exists;
- it needs a decision;
- it touches the authentication flow, credentials or the deploy, where a
  person writes the fix.

Open at most six pull requests in a run, the highest payoff first. The rest
wait for next week. A finding of size L, or one that is only plausible, stays
in the issue.

Give each fix its own subagent in its own worktree. Its branch is
`backend-review/<yyyy-mm-dd>-<slug>`, and it works from `origin/main`. Tell
each one to:
1. Reproduce the finding first: a test that fails, or the measurement. If it
   does not reproduce, stop and report back. The finding then leaves the
   issue with that reason.
2. Make the smallest fix the finding needs, following the rules that cover
   the code.
3. Commit, staging files by path. Then run
   `flock /tmp/oppenheimer-ci.lock pnpm ci:local`; the lock serialises the
   subagents, which share the stack's ports. Push only on a green run.
4. Open the pull request against `main`, ready for review, labelled
   `backend-review`, following the steward skill:
   - the `## Local CI` report;
   - `## Screenshots` if the change is visual;
   - "Part of #<issue>".
5. Never merge.

Link every pull request from its finding in the issue and from that day's
comment. A subagent that could not get to green leaves no pull request;
record why in the comment.
