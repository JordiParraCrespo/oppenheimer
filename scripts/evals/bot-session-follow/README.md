# Bot session follow eval

Does a bot follow a session it says it will come back to?

On 2026-11-10 Facturas told the owner it would check a session "when it
pushes" and send the October table after, and nothing woke it: it had only
read that session, which it had not started. A bot now says it will come
back to a session only when something will wake it, and `watch_session`s
any other before its turn ends, with `check_in_minutes` for a time it names
(`product/versions/mvp/27-bot-subscriptions.md` §4.2).

## The cases

`cases.json` holds one bot (Facturas) and 4 cases, each one message from the
person about a session the bot did not start:

| Case | Session | A right run |
| --- | --- | --- |
| `tell-me-when-pushed` | running | watches it |
| `final-table-later` | running | watches it (the screenshot's own words) |
| `look-again-20` | running | watches it with `check_in_minutes` near 20 |
| `already-done` | finished | does not watch it |

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-session-follow                          # every case, 3 runs each
pnpm eval:bot-session-follow --case look-again-20     # one case
```

Each run builds the bot's real system prompt and serves the production
session tools over the in-memory workspace (`../bot-workspace.ts`).
`watch_session` is the production definition with a stand-in run that
answers as a stored watch would. The model is
`BOT_SESSION_FOLLOW_EVAL_MODEL` (default `claude-sonnet-5-5`), on the
Messages API with `ANTHROPIC_API_KEY`, else the machine's Claude Code login.

Marks: `W` watched, `C` watched with a check-in in range, `c` out of range,
`w` watched what it should not, `-` did not watch, `.` rightly did not.

## Results

| Date | Code | Model | Right | Notes |
| --- | --- | --- | --- | --- |
| 2026-11-11 | `main` | claude-sonnet-5-5 | 9/12 | `look-again-20` 0/3: "I can't set a timer"; asked outright, it already watched |
| 2026-11-11 | this change | claude-sonnet-5-5 | 12/12 | `look-again-20` 3/3 at 20 minutes |

Asked outright ("tell me when it has pushed"), the bot watched on `main`
too, so this eval does not reproduce the screenshot's miss. What it shows
is the timed look, which `main` could not do.
