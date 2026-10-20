---
name: ship
description: Finish the task in hand and merge its pull request, without stopping to ask unless a stop condition holds. Finishes the work, drives the pull request with the steward skill, then merges it pinned to the head that steward got green. Use only when the user invokes /ship or explicitly asks to finish and merge on their own.
disable-model-invocation: true
argument-hint: "[pull request number or extra instructions]"
---

# Ship

Invoking this skill is the user's approval to merge **this one pull request**
without asking again, unless a stop condition below holds. It does not extend
to other pull requests or to later sessions.

`ship` owns two things: finishing the work, and the merge. Everything between
(commit, local CI, push, the pull request, its report, review threads, merging
`main` in) is `.agents/skills/steward/SKILL.md`, unchanged.

## 1. Finish the task

- Re-read the request and the conversation; do what is left of it. If
  `$ARGUMENTS` names a pull request, check out its head branch and take its
  description as the task.
- Keep to what was asked. Anything else you notice goes in the pull request
  description as a follow-up, not into the diff.
- Follow the rules and docs that govern the code you touch, as for any change.
- Run the `deslop` skill over the branch diff.

## 2. Drive the pull request

Follow `steward` until it calls the pull request ready. Answer review threads
as you go, and keep working the pull request on every event while you do.

## 3. Merge

Fetch the pull request fresh and merge only when all of these hold:

- `steward` calls it ready, and the head SHA is the one its report names;
- it has no conflict with its base branch: GitHub reports it mergeable
  (`mergeable` true, not `dirty`). A conflict is not a stop: merge the base
  in per `steward`, and the new head goes back through step 2;
- it has at least one submitted review from a user account, not a bot, and
  no review is requesting changes;
- every review thread is resolved;
- no stop condition holds.

With no review yet, the pull request waits for one: say so once.

Merge pinned to that head SHA, so a head nobody checked fails the merge
instead of landing, and with the repository's merge method (merge commits).
If the merge is refused because the head or the base moved, go back to step
2. Never merge with admin rights or bypass branch protection.

After the merge, stop following the pull request and tell the user: its link,
the merge commit, what shipped, and the follow-ups left in its description.

## Stop conditions

Leave the pull request open, as far along as you got, and ask the user before
merging when:

- the task is ambiguous, or finishing it needs a decision that is theirs (an
  API or schema change nobody asked for, a product call, deleting data);
- a review thread is unresolved, a reviewer asks for more than the task, or a
  security finding is open;
- the diff touches a security-sensitive path: auth, authorization, scopes or
  credentials (`packages/auth`, `packages/backend/authz`,
  `packages/shared/src/scopes`, `apps/api/src/auth*`), the agent guardrails
  (`.claude/settings.json`, `.agents/hooks/`), workflows (`.github/`), the
  deployment (`deploy/`) or a migration;
- a person's approval is required by branch protection or a code owner;
- `main-red` is open and this pull request is not its fix;
- CI or the merge keeps failing for a reason you cannot state.

Say exactly what blocks the merge and what you need. The pull request stays
yours: keep working it on every event that reaches you.
