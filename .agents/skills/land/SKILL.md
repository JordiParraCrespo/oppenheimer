---
name: land
description: Finish a fix and merge it without asking, or merge a pull request the user has accepted. When it conflicts, merges its target in, resolves, reruns local CI and babysits it until it merges. Labels the pull request `land`, drives it with the steward skill, has a fresh agent verify it, babysits it, and merges it. Use only when the user invokes /land.
disable-model-invocation: true
argument-hint: "[what to fix, or a pull request number]"
---

# Land

`/land` is the user's approval to merge **this one pull request**. The merge
protocol (the three labels and what each one waits for) is
`.agents/skills/steward/SKILL.md`, "Merging"; this skill is the `land` lane.

Two ways in:

- **`/land <task>`**: a fix. Do the work, then everything below.
- **`/land` on a `propose` pull request** (in its session, or with its
  number): the user accepted it. Swap the label `propose` for `land` and go
  to step 4; its verdict stands if the code has not changed since.
- **`/land` on any other open pull request**: the user wants it merged. Go to
  step 4 with it as it is; one with no `PASS` gets step 3 first.

## 1. Fix it

- Reproduce the bug first, on the surface it shows on: a failing test, a
  command, or a screenshot of the broken state. Commit the failing test
  before the fix when there is a cheap one.
- Fix the root cause, nothing beyond it. Anything else you notice goes in
  the description as a follow-up.
- Take the steps in the order `steward` writes down ("The order").

A `/land <task>` becomes a `/propose` (label `propose`, wait for the user),
and you say why, when the work turns out to need:

- new behavior, an endpoint, a schema or a migration (it is a feature);
- a change to auth, authorization, scopes or credentials, the agent rules
  (`.claude/`, `.agents/`, the root `AGENTS.md`), `.github/` or `deploy/`.

## 2. Open it

Open the pull request ready, with the `land` label, and subscribe to its
activity.

## 3. Verify it

Spawn one fresh agent that did not write the code. Brief it with the pull
request number and head SHA, the bug and its repro, and ask it to:

1. check out the head and confirm the SHA;
2. show the repro failing on `origin/main` and passing on the head, on the
   same surface (the `local-stack` skill for the console, the runner or the
   relay; the real command or request otherwise);
3. read the diff for anything it breaks;
4. answer `PASS` or `FAIL`, with the commands, outputs and screenshots that
   show it. A step it could not run is a `FAIL`, never a pass.

Post the verdict on the pull request as one comment naming the SHA. A
`FAIL` is a finding: fix it, push, and verify the new head.

## 4. Babysit and merge

On every event and check-in, fetch it fresh (`mergeable` can read unknown
while GitHub computes it; read it again, it is not a conflict) and:

1. **Merge it if it is clean**, when all of these hold:
   - `steward` calls it ready, and the verdict is `PASS` on this head, or
     on a head whose only change since is a merge of the base with a
     green `pnpm ci:local`;
   - GitHub reports it mergeable, no review requests changes, and every
     finding is answered (`steward`, "Babysitting", step 2 says what counts
     as one), its thread resolved;
   - Codex has finished reviewing the last head that changed behavior (the
     one the pull request was opened or marked ready on, or the last push
     `steward`, "Babysitting", step 3 asked it about; a later push of
     comments, docs or tests, or a merge of the base, needs no new review):
     its summary comment's `codex-review-state` names that SHA with
     `"status":"completed"`. If it has not finished 30 minutes after it was
     asked (or after the pull request was opened), say so on the pull request
     and merge without it. A `research` pull request skips this;
   - no `main-red` issue is open that it does not fix.

   Merge with a merge commit pinned to the head SHA, never with admin
   rights, squash or rebase. A merge refused because the head moved is
   not a failure: fetch again. Read it back to confirm it merged,
   unsubscribe, drop the check-in, and tell the user: the link, the merge
   commit, the verdict, what shipped, and the follow-ups.
2. **Otherwise babysit it** per `steward`, "Babysitting" (a conflict is
   its step 1), then back to 1. Tell the user what only they can clear: a
   change request, a product call, a `main-red` that is not yours.

Stop when it merges or closes, or when the user says to.
