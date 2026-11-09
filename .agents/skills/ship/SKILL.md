---
name: ship
description: Finish a fix and merge it without asking, or merge a pull request Jordi has accepted. When it conflicts, merges its target in, resolves, reruns local CI and babysits it until it merges. Labels the pull request `ship`, drives it with the steward skill, has a fresh agent verify it, babysits it, and merges it. Use only when the user invokes /ship.
disable-model-invocation: true
argument-hint: "[what to fix, or a pull request number]"
---

# Ship

`/ship` is Jordi's approval to merge **this one pull request**. The merge
protocol (the three labels and what each one waits for) is
`.agents/skills/steward/SKILL.md`, "Merging"; this skill is the `ship` lane.

Two ways in:

- **`/ship <task>`**: a fix. Do the work, then everything below.
- **`/ship` on a `propose` pull request** (in its session, or with its
  number): Jordi accepted it. Swap the label `propose` for `ship` and go
  to step 4; its verdict stands if the code has not changed since.
- **`/ship` on any other open pull request**: Jordi wants it merged. Go to
  step 4 with it as it is; one with no `PASS` gets step 3 first.

## 1. Fix it

- Reproduce the bug first, on the surface it shows on: a failing test, a
  command, or a screenshot of the broken state. Commit the failing test
  before the fix when there is a cheap one.
- Fix the root cause, nothing beyond it. Anything else you notice goes in
  the description as a follow-up.
- Take the steps in the order `steward` writes down ("The order").

A `/ship <task>` becomes a `/propose` (label `propose`, wait for Jordi),
and you say why, when the work turns out to need:

- new behavior, an endpoint, a schema or a migration (it is a feature);
- a change to auth, authorization, scopes or credentials, the agent rules
  (`.claude/`, `.agents/`, the root `AGENTS.md`), `.github/` or `deploy/`.

## 2. Open it

Open the pull request ready, with the `ship` label, and subscribe to its
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

Keep the pull request mergeable and merge it. `research` merges through
this step too, without the verdict. On every event and check-in, fetch it
fresh (`mergeable` can read unknown while GitHub computes it; read it
again, it is not a conflict) and:

1. **Merge it if it is clean**, when all of these hold:
   - `steward` calls it ready, and the verdict is `PASS` on this head, or
     on a head whose only change since is a merge of the target with a
     green `pnpm ci:local`;
   - GitHub reports it mergeable, no review requests changes, and every
     review thread is answered and resolved;
   - no `main-red` issue is open that it does not fix.

   Merge with a merge commit pinned to the head SHA, never with admin
   rights, squash or rebase. A merge refused because the head moved is
   not a failure: fetch again. Read it back to confirm it merged,
   unsubscribe, drop the check-in, and tell the user: the link, the merge
   commit, the verdict, what shipped, and the follow-ups.
2. **Bring it up to date when it conflicts**, or is behind a base that
   must be current:
   - check out its head, confirm the SHA, `git fetch origin <base>` and
     `git merge origin/<base>`; never rebase or force-push;
   - resolve each conflict by reading both sides and the commits behind
     them (`git log --merge -p <file>`): keep what each side meant, not
     one side wholesale. Lockfiles and generated files are never
     hand-merged: take either side and regenerate them with their tooling
     (`pnpm install`, `pnpm generate:api-client`, the router's generator,
     `pnpm generate:guide`, `product/brief.html` from its notes);
   - a conflict that needs a product call (both sides changed the same
     behavior, or one deleted what the other built on) goes to Jordi with
     the file, both sides in a sentence each and your default; leave the
     merge uncommitted until he answers;
   - commit the merge staging files by path, then `steward`, "After a
     merge from main": `pnpm ci:local`, fix red through "The order", push
     on green, replace the report. A resolution that changed behavior
     needs the verdict again (and screenshots, for a visual file); a plain
     merge does not. Then back to 1.
3. **Otherwise babysit** per `steward`, "Babysitting": answer or fix review
   comments, keep one check-in armed about every hour while it is open,
   say once what it waits for, and tell Jordi what only he can clear (a
   change request, a product call, a `main-red` that is not yours).

Stop when it merges or closes, or when Jordi says to.
