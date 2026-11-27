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
