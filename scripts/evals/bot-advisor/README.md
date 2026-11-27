# bot-advisor

A bot sets its own advisor when the person asks: "give yourself Opus 5.5 as
your advisor" is an `update_bot` call for the bot itself that names it, and
"turn your advisor off" one that clears it, with nothing else of its engine
changed (2026-11-27).

It measures `update_bot`'s description and its `advisor_model` input
(`bots/tools.update-bot*` in `apps/api/src/bots-chat/domain/prompts/bots/tools.md`).
The runner serves `get_self` and `update_bot` as stubs with their production
descriptions and schema, the advisor kept for the run so a read after the
update sees it, and runs one turn on a Sonnet 5.5 bot.

```bash
pnpm eval:bot-advisor                     # every case, 3 runs each
pnpm eval:bot-advisor --case off --runs 1
```

`BOT_ADVISOR_EVAL_MODEL` picks the model (default `claude-sonnet-5-5`).

## Cases

| Case | The person says | Right |
| --- | --- | --- |
| `set` | Give yourself Opus 5.5 as your advisor | `advisor_model` Opus 5.5 (id or label) |
| `off` | Turn your advisor off (it is Opus 5.5) | `advisor_model` null |
| `label-es` | Quiero que Opus 5.5 te asesore… | `advisor_model` Opus 5.5 |

## Results

| Date | Model | Before (no `advisor_model`) | After |
| --- | --- | --- | --- |
| 2026-11-27 | claude-sonnet-5-5 (Claude Code login) | 0/3 (`--runs 1`): each answered it cannot set an advisor | 9/9 |

## Does an advisor help? (2026-11-27)

`BOT_EVAL_ADVISOR` and `BOT_EVAL_EFFORT` (`../bot-turn.ts`) run any bot eval
with an advisor or an effort level on the Claude Code login, and end with
what each model spent. Two judgement evals, graded in code, 2 runs a case,
on Sonnet 5.5:

| Set-up | `bot-blocked-run` | `bot-session-unblock` | Advisor consulted | Tokens in / out |
| --- | --- | --- | --- | --- |
| medium | 20/20 | 18/18 | n/a | 1.47M / 17.6k |
| medium, Opus 5.5 advisor | 19/20 | 18/18 | 1 of 38 runs | 1.64M / 18.2k, Opus 17k / 0.8k |
| high | 20/20 | 18/18 | n/a | 1.58M / 22.0k |

Neither eval can show a gain: the bot passes every case at medium. The bot
consulted its advisor once in 38 runs, so on work like this an advisor
costs little and changes little. The miss with an advisor (a blocker said
again, `told-only-that-session-already-said`) is one run in 20. Claude
Code's own dollar figures swing with prompt caching, so the tokens are the
comparison. Whether an advisor earns its cost needs cases the bot fails at
medium, which no bot eval has yet.
