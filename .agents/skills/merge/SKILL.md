---
name: merge
description: Merge a pull request now, or keep it mergeable until it merges. If GitHub can merge it cleanly, merges it; if not, merges its target branch into it, resolves the conflicts, runs the local CI and tries again, and babysits it until it is merged. Use only when the user invokes /merge.
disable-model-invocation: true
argument-hint: "[pull request number or link; none for this branch's]"
---

# Merge

`/merge` is Jordi saying "merge this one", for the pull requests it names,
whatever their label (`steward`, "Merging": a pull request merges when
Jordi says so). It does not do the pull request's work for it: it gets the
branch onto its target, keeps it there, and merges.

It is also how the lanes merge. `ship` (step 4, which an accepted
`propose` reaches too) and `research` (step 2) check what their lane waits
for (a `PASS`, Jordi's acceptance, a green report) and then run this skill
from step 1 for their own pull request.

## 1. Find it

The argument is a number, a link, or several of them; with none, the open
pull request whose head is the current branch. For each, read it fresh:
state, base and head branch, head SHA, `mergeable` and `mergeable_state`,
reviews and review threads. `mergeable` can come back unknown while GitHub
computes it; read it again a few seconds later, it is not a conflict.

Stop and tell Jordi, without touching the branch, when it is closed or
already merged, or its head lives in a fork this session cannot push to.

## 2. Merge it if it is clean

It merges now when all of these hold:

- GitHub reports it mergeable (`clean`, or `unstable` for a check that is
  not required), with no conflict;
- no review requests changes, and every review thread is answered and
  resolved;
- its description carries a green `## Local CI` report naming its head, or
  its head is a merge of the target branch onto a head that had one and
  `pnpm ci:local` is green on it (step 3 adds it);
- no `main-red` issue is open that it does not fix, when the target is
  `main`.

Merge with a merge commit, pinned to the head SHA, never with admin rights
and never squash or rebase. Read it back to confirm it merged, unsubscribe
from its activity, and tell Jordi: the link, the merge commit, and what
went in.

A merge refused because the head moved since you read it is not a failure:
go back to step 1.

## 3. Bring it up to date when it is not

When it conflicts, or GitHub says it is behind and the base requires it to
be up to date:

1. Check out its head branch, fetch, and confirm the local head is the SHA
   from step 1.
2. `git fetch origin <base>` and `git merge origin/<base>`. Never rebase,
   never force-push: other sessions may hold the branch.
3. Resolve each conflict by reading both sides and the commits that made
   them (`git log --merge -p <file>`): keep what each side meant, not one
   side wholesale. Generated files and lockfiles are never hand-merged:
   take either side, then regenerate with their tooling (`pnpm install`
   for `pnpm-lock.yaml`, `pnpm generate:api-client` for the API client,
   the router's generator for `routeTree.gen.ts`, `pnpm generate:guide`
   for the docs guide bundle, `product/brief.html` from its notes).
4. A conflict you cannot resolve without a product call (both sides
   changed the same behavior differently, or one side deleted what the
   other built on) goes to Jordi: the file, both sides in a sentence each,
   your default. Leave the merge uncommitted (`git merge --abort` if the
   session has to move on) until he answers.
5. Commit the merge, staging files by path. Then `steward`, "After a merge
   from main": `pnpm ci:local` on the new head, red is yours to fix (the
   fix goes through `steward`, "The order", from step 2), push on green,
   and replace the `## Local CI` report in the description. A resolution
   that changed behavior on either side needs the pull request's verdict
   again and, for a visual file, its screenshots; a plain merge does not.
6. Back to step 1 with the new head.

## 4. Babysit it until it merges

When step 2 still does not hold (a review thread, a change request, a
red `main`, a conflict waiting on Jordi, or GitHub still computing):

- Subscribe to its activity and work it per `steward`, "Babysitting", on
  every event: a new conflict is step 3, a review comment is answered or
  fixed, and after each one try step 2 again.
- Keep one check-in armed about every hour while it is open, so a merge to
  the target that conflicts with it is caught without an event; drop it
  once the pull request merges or closes.
- Say once what it waits for, then stay quiet until something changes.
  Something only Jordi can clear (a change request, a product call, a
  `main-red` that is not yours) is said to him with what you need, not
  worked around.

Stop when it is merged (step 2's report) or closed, or when Jordi says to.
