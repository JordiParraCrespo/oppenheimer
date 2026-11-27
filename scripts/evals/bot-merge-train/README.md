# bot-merge-train

A long task with traps: "merge the open pull requests of acme/… that are
ready, in the right order, and tell me what's left". The bot reads each pull
request (`list_pull_requests`, `get_pull_request`, `merge_pull_request` with
their production descriptions) and merges exactly the ready ones, each after
what it depends on. A merge always succeeds, as on a repository with no
branch rules, so only the bot's reading stops one. Graded in code: what was
merged, and in which order.

| Case | Traps |
| --- | --- |
| `release-train` | a dependency in a description (listed first), a "hold off" after an approval, changes requested after an approval, a failing check |
| `hard-train` | a dependency in a comment, a transitive block (ready itself, needs a failing one first), a hold lifted later (ready), "do not merge before 1 December" (today is 27 November) |

```bash
pnpm eval:bot-merge-train                         # every case, 3 runs each
pnpm eval:bot-merge-train --case hard-train --runs 8
```

`BOT_MERGE_TRAIN_EVAL_MODEL` picks the model (default `claude-sonnet-5-5`);
`BOT_EVAL_EFFORT`, `BOT_EVAL_ADVISOR` and `BOT_EVAL_ADVISOR_NUDGE`
(`../bot-turn.ts`) set the effort, an advisor, and a line telling the bot to
consult it before it acts.

## Results (2026-11-27, Claude Code login, medium effort)

| Set-up | `release-train` | `hard-train` | Advisor consulted | Cost per `hard-train` run, as Claude Code reports it |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 | 3/3 | 3/3 | n/a | ~$0.05 |
| Haiku 5.5 | 5/5 | 9/13 (3/3, 0/2, 6/8) | n/a | ~$0.003 |
| Haiku 5.5 + Opus 5.5 advisor | 2/2 | 7/10 (2/2, 5/8) | 1 of 14 runs | ~$0.003 |
| Haiku 5.5 + Opus 5.5 advisor, nudged | | 8/8 | 8 of 8 runs | ~$0.088 (the advisor ~95%) |

Haiku's misses all leave the pull request whose hold was lifted later. An
advisor the bot is told to consult fixes them; one it is only offered is
not consulted. Told to consult, Haiku with an advisor matches Sonnet alone
and costs more per run (~$0.088 against ~$0.05 as reported, about even at
list prices without caching), so here an advisor buys nothing that choosing
Sonnet does not.
