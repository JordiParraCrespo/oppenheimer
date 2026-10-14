---
name: ship
description: Finish the task in hand and merge it, without stopping to ask. Completes the remaining work, commits, runs `pnpm ci:local` until green, pushes the branch, opens or updates the pull request with the report, answers every review thread, and merges it into main once every gate holds. Use only when the user invokes /ship or explicitly asks to finish and merge on their own.
disable-model-invocation: true
argument-hint: "[pull request number or extra instructions]"
---

# Ship

Invoking this skill is the user's standing approval to merge **this one pull
request** without asking again. It does not extend to other pull requests, to
later sessions, or to anything the gates below refuse. Pushing and the pull
request follow `.agents/skills/steward/SKILL.md`; read it first. This skill
adds the parts before it (finish the work) and after it (merge).

Work through the steps in order. Do not stop to ask between them: ask only
when a stop condition (the last section) is met.

## 1. Finish the task

- Re-read the user's request and the conversation. List what was asked and
  what is not done yet; do the rest. If `$ARGUMENTS` names a pull request,
  check out its head branch and take its description as the task.
- Keep to what was asked. Work you notice but nobody asked for goes in the
  pull request description as a follow-up, not into the diff.
- Follow the rules that govern the code you touch (`.agents/rules/`), the
  docs that go with it (README, AGENTS.md, `apps/docs`, `product/` notes and
  `product/README.md` when a decision changed), and the generators
  (`pnpm generate:api-client`, `routeTree.gen.ts`, lockfile) by their
  tooling, never by hand.
- Run the fast checks of what you touched while you work (`pnpm check`,
  the changed package's tests, `pnpm arch`) so `ci:local` is a confirmation,
  not the first look.
- Run the `deslop` skill over the branch diff.

## 2. Commit and run CI

1. Stage files by path (never `git add -A` / `.`), and commit with a
   conventional-commit message.
2. Run `pnpm ci:local`. A red row is yours: root-cause it, fix it, commit,
   and run again. Never `--skip` a job to get green, never skip, disable or
   quarantine a test.
3. Repeat until the run is green on the head commit. Five red runs in a row
   that you cannot explain is a stop condition.

## 3. Push and open the pull request

1. `git push -u origin <branch>`. Never main, never a force push.
2. If no open pull request exists for the branch, open one ready for review,
   following the repository's template if it has one. Otherwise update the
   existing one.
3. Put `.ci-local/report.md` under a `## Local CI` heading in the
   description, replacing any earlier report, so it names the head commit.

## 4. Clear the gates

Fetch the pull request fresh (`mcp__github__pull_request_read`: the pull
request, its reviews, its review threads and its status) and check each gate.
All must hold on the **current head SHA**:

| Gate | Holds when |
| --- | --- |
| Report | The `## Local CI` report names the head SHA and every row is green |
| Mergeable | GitHub reports no conflict with `main` |
| Reviews | No review is `CHANGES_REQUESTED`; every review thread has an answer and the ones you addressed are resolved |
| Checks | Any GitHub check or status that does run on the head is green (most pull requests have none here; do not wait for one that never starts) |
| Main | No open `main-red` issue, unless this pull request is its fix |
| Scope | The diff is what the task asked for: no stray files, no env files, no secrets |

Work every gate that fails, then check them all again:

- **Conflict or main moved**: `git fetch origin main`, merge it into the
  branch (a merge commit, never a rebase of pushed history), resolve,
  regenerate generated files with their tooling, then go back to step 2: a
  merge is a new head and needs its own green report.
- **Review comments**: implement the small, local asks and answer each
  thread; reply with a proposal on a larger design ask instead of building
  it, and treat that as a stop condition. Every finding marked blocking is
  fixed, not argued. A fix is a new head: back to step 2.
- **Red check on GitHub**: fix it as a CI failure (step 2).

## 5. Merge

When every gate holds:

1. Read the pull request once more and confirm its head SHA is the one the
   report names. If it moved, go back to step 4.
2. Merge with `mcp__github__merge_pull_request`, passing that `sha` so the
   merge fails rather than lands a head nobody checked, and
   `merge_method: "merge"` (the repository keeps merge commits).
3. If GitHub refuses because the base moved or the head changed, go back to
   step 4. Three refused merges in a row is a stop condition.
4. After the merge, unsubscribe from the pull request's activity and tell the
   user, in a few lines: the pull request link, the merge commit, what
   shipped, and the follow-ups left in the description.

Never merge with admin rights, bypass branch protection, push to `main`
directly. If branch protection requires a
human approval, that is a stop condition, not something to route around.

## Stop conditions

Stop, leave the pull request open and green as far as you got, and tell the
user exactly what blocks it and what you need, when:

- the task is ambiguous in a way the code and the conversation do not settle,
  or finishing it needs a decision that is the user's (an API or schema
  change nobody asked for, a product decision, deleting data);
- a reviewer asks for a change larger than the task, or a security finding
  is open;
- branch protection, a required review or a code owner needs a person;
- CI stays red five runs in a row, or merges are refused three times in a
  row, and you cannot say why;
- `main-red` is open and this pull request is not its fix.

Stopping is not failing: the pull request stays yours and you keep working it
on every event that reaches you.
