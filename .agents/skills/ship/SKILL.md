---
name: ship
description: Finish the task in hand, drive its pull request with the steward skill, verify it independently with the verify-pr workflow, then merge it by its lane - a fix merges on its own once verified, a feature waits for Jordi to accept it, research is never merged by an agent. Use when the user invokes /ship, asks to finish and merge, or when a pull request steward calls ready needs its merge decided.
argument-hint: "[pull request number or extra instructions]"
---

# Ship

The merge policy in the root `AGENTS.md` is the user's standing approval:
a `fix` pull request merges without asking once it is verified; anything
else merges only when Jordi accepts it. This skill is how that policy runs.
It never extends past the lane a pull request is in.

`ship` owns three things: finishing the work, the independent verdict, and
the merge. Everything between (commit, local CI, push, the pull request, its
report, review threads, merging `main` in) is
`.agents/skills/steward/SKILL.md`, unchanged.

## 1. Finish the task

- Re-read the request and the conversation; do what is left of it. If
  `$ARGUMENTS` names a pull request, check out its head branch and take its
  description as the task.
- Keep to what was asked. Anything else you notice goes in the pull request
  description as a follow-up, not into the diff.
- Follow the rules and docs that govern the code you touch, as for any change.
- A fix is reproduced before it is fixed: a failing test, a command or a
  screenshot of the broken state, committed or recorded before the fix.
- Run the `deslop` skill over the branch diff.

## 2. Pick the lane

The lane comes from the pull request's Conventional Commit title and its
diff, decided once per head:

| Lane | Title type | Merges when |
| --- | --- | --- |
| `fix` | `fix` | verified (step 4), no person needed |
| `feature` | `feat`, `perf`, `refactor`, `test`, `chore`, `build`, `ci`, `docs` outside `product/` | verified, and Jordi accepted this pull request |
| `research` | `docs(product)`, or a diff only under `product/` | never by an agent; Jordi merges it himself |

A `fix` drops to `feature` when any of these holds; say which in the pull
request description:

- the diff touches a path in **Always ask** below;
- it adds or changes an API endpoint, a schema, a migration, a feature flag,
  a dependency, or what a user can do (a fix restores behavior, it does not
  add it);
- it is larger than about 300 changed lines outside tests and generated files;
- the verdict is `PASS+NOTES` and a note asks a person to decide something.

Name the lane in the description, under `## Lane`, with one line on why.

## 3. Drive the pull request

Follow `steward` until it calls the pull request ready. Answer review threads
as you go, and keep working the pull request on every event while you do.
Reviews from bots, including the ones posted from Jordi's own account (they
open with a `[... BOT REVIEW]` tag), are findings to triage per steward,
never an approval.

## 4. Verify independently

A verdict comes from agents that did not write the code, run against the
head steward got green. Run the saved workflow:

```
Workflow({ name: "verify-pr", args: { pr: <number>, head: "<head sha>", lane: "<lane>" } })
```

It re-runs the gates, drives the change on the real surface (`local-stack`
for the console, the runner or the relay; the real command for a CLI;
requests against the stack for an endpoint), audits the diff adversarially,
refutes each audit finding with a skeptic, and returns `PASS`,
`PASS+NOTES`, `FAIL` or `BLOCKED` with evidence per lane. `needsPerson`
true means a note is a decision for Jordi, which puts a `fix` in the
`feature` lane. `BLOCKED` is a lane that could not run: a stop condition,
never a pass.

- Post the verdict on the pull request as one comment, naming the head SHA
  and each lane's result and evidence. Replace it on every new verdict.
- `FAIL` goes back to step 3 as findings: fix with a red-first test, push,
  and verify the new head.
- A verdict covers one patch. After a new head, compare
  `git patch-id` at the verdict SHA with the head: a merge of `main` that
  leaves the patch the same needs only the gates lane again
  (`args.lanes: ["gates"]`); a code change needs the whole workflow again.
- The research lane skips this step.

## 5. Merge

Fetch the pull request fresh and merge only when all of these hold:

- `steward` calls it ready, and the head SHA is the one its report names;
- the verdict is `PASS` (or `PASS+NOTES` with nothing for a person to
  decide) and covers this head per step 4;
- GitHub reports it mergeable (`mergeable` true, not `dirty`). A conflict is
  not a stop: merge the base in per `steward`, and the new head goes back
  through steps 3 and 4;
- no review is requesting changes and every review thread is resolved;
- for the `feature` lane: Jordi accepted it, after the verdict was posted.
  Acceptance is Jordi saying so in this session ("accepted", "merge it",
  "ship it") or adding the `accepted` label to the pull request. A review,
  approving or not, is not acceptance: the bot reviews post from his
  account. Acceptance covers the head it was given on; a later code change
  (not a merge of `main` with the same patch-id) needs it again;
- no stop condition holds.

With the `feature` lane verified and not yet accepted, say once that it
waits on Jordi, with the pull request's link, the verdict and the one thing
to look at first. The `research` lane stops after step 3: say it is ready
for Jordi to read.

Merge pinned to that head SHA, so a head nobody checked fails the merge
instead of landing, and with the repository's merge method (merge commits).
If the merge is refused because the head or the base moved, go back to step
3. Never merge with admin rights or bypass branch protection.

After the merge, read the pull request back and confirm it is merged into
`main`, stop following it, and tell the user: its link, the lane, the merge
commit, the verdict, what shipped, and the follow-ups left in its
description.

## Always ask

These paths put a pull request in the `feature` lane whatever its title,
and an open security finding stops any lane:

- auth, authorization, scopes or credentials (`packages/auth`,
  `packages/backend/authz`, `packages/shared/src/scopes`,
  `apps/api/src/auth*`);
- the agent guardrails and this process (`.claude/`, `.agents/hooks/`,
  `.agents/skills/ship/`, `.agents/skills/steward/`, the root `AGENTS.md`);
- workflows (`.github/`), the deployment (`deploy/`) or a migration.

## Stop conditions

Leave the pull request open, as far along as you got, and ask the user before
merging when:

- the task is ambiguous, or finishing it needs a decision that is theirs (an
  API or schema change nobody asked for, a product call, deleting data);
- a review thread is unresolved, a reviewer asks for more than the task, or a
  security finding is open;
- a person's approval is required by branch protection or a code owner;
- `main-red` is open and this pull request is not its fix;
- the verifiers cannot run a lane (no Docker, the stack does not start): a
  missing lane is a gap, never a pass;
- CI, the verdict or the merge keeps failing for a reason you cannot state.

Say exactly what blocks the merge and what you need. The pull request stays
yours: keep working it on every event that reaches you.
