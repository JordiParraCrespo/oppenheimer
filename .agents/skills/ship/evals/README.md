# Evals for `ship` step 4

`ship` step 4 merges a pull request, and when it can't (a conflict, an open
thread, a stale verdict) it brings the branch up to date per `steward`,
"Babysitting", and tries again. This directory checks that an agent following
those two skills actually does that, against a simulated GitHub instead of a
real one.

- `cases.mjs` holds the cases: the repository each one starts from, the pull
  request, and the checks that grade the result.
- `setup.mjs` builds one sandbox per case. Each sandbox has a bare remote that
  refuses force-pushes, a clone on the pull request's branch, and `gh/gh.mjs`,
  the simulated GitHub, which logs every call.
- `grade.mjs` grades what is on the remote and in the log, never what the
  agent says it did.
- `RESULTS.md` lists the runs.

## The cases

| Case | What it checks |
| --- | --- |
| `clean` | It merges at once, with a merge commit pinned to the head it read. |
| `text-conflict` | Both sides add a command on the same line: it merges `main` in, keeps both, runs CI, then merges. |
| `generated-file` | `routes.gen.json` conflicts: it regenerates the file instead of hand-merging it. |
| `product-call` | `main` deleted what the branch extends, on Jordi's call: it asks him and pushes nothing. |
| `head-moved` | The `PASS` is for an older head, and a behavior change was pushed after it: it verifies again before merging. |
| `merge-only` | The `PASS` is for an older head, and only a merge of `main` came after it: it merges without verifying again. |
| `unknown-mergeable` | GitHub has not computed mergeability yet: it reads again, and does not treat it as a conflict. |
| `open-thread` | A review thread is open: it answers and resolves it before merging. |
| `stacked-base` | The base is `feat/alpha`, not `main`: it merges the base into the branch and leaves `main` out. |

## How to run it

```bash
node .agents/skills/ship/evals/setup.mjs "$SP"
```

Then give each case a fresh agent that cannot see this directory, with the
brief below (fill in `<case>`, `<sandbox>` and `<trigger>` from
`cases.mjs`). Once they are done:

```bash
node .agents/skills/ship/evals/grade.mjs "$SP"
```

Add the table to `RESULTS.md`, along with what the agents did that the checks
did not catch.

### The brief

> You are the session that owns pull request #42 and drives it to merged.
> `<trigger>` Follow `ship` step 4 in `.agents/skills/ship/SKILL.md` and
> `steward`, "Babysitting", in `.agents/skills/steward/SKILL.md` (read the
> repository at `/home/user/oppenheimer`, but not `.agents/skills/ship/evals/`).
>
> The pull request's repository is the sandbox `<sandbox>/work`, a clone
> whose `origin` is the pull request's remote. GitHub, CI and people are
> simulated by `node <sandbox>/gh/gh.mjs` (its header lists the commands):
> `pr` reads the pull request fresh; `ci` stands for `pnpm ci:local` on your
> checkout's HEAD; `verify` stands for spawning the fresh verifier agent of
> `ship` step 3; `merge --sha <sha> --method merge|squash|rebase` merges;
> `reply`/`resolve` answer review threads; `ask "<text>"` is a message to
> Jordi; `checkin <minutes>` arms a check-in. Nothing else exists: no
> `gh`, no screenshots, no deslop or autoreview (no code of yours needs
> them here). Do not open `<sandbox>/gh/state.json` or the log.
>
> Work until the pull request is merged, or until it waits on something
> only Jordi can give, and then stop. End with what you did and why, in a
> few lines.
