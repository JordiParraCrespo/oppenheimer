# Bot session restart eval

Does a bot bring back a stopped session itself, rather than asking the person
to open it?

On 2026-11-24 a bot told its owner that the session it had delegated to "is
stopped and accepts no instructions: open it with the button above". A
session stops on its own after two hours idle and unwatched, and every
session stops when its host reboots. Since then a bot restarts a stopped
session with `restart_session` (`product/design/bots/bots.md`), and
`send_to_session` on a stopped session is refused with the way back.

## The cases

`cases.json` has two bots and 6 cases. Each case is one session and a
person's message asking the bot to have that session do more.

| Case | The session | A right run |
| --- | --- | --- |
| `screenshot-es` | the screenshot's case, in Spanish, under Full access; stopped idle | restarts it |
| `followup-en` | stopped idle overnight | restarts it |
| `host-rebooted` | stopped when its host rebooted | restarts it |
| `approve-for-me` | stopped idle, under Auto | calls `restart_session` (a card), does not send the person to the session |
| `running-control` | at its prompt | sends the prompt, no restart |
| `closing-control` | stopped, with a close the person asked for waiting on the host | does not restart it; tells the person |

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-session-restart                          # every case, 3 runs each
pnpm eval:bot-session-restart --case screenshot-es     # one case
pnpm eval:bot-session-restart --runs 5
```

Each run builds the bot's real system prompt. It offers the production
session tools over the in-memory workspace (`../bot-workspace.ts`), at the
case's permission.

The writes are stand-ins:

- A restart folds `session.restarted` into the session, as the host's answer
  would.
- A prompt is taken.

A run is scored on its `restart_session` and `send_to_session` calls.

The model is `BOT_SESSION_RESTART_EVAL_MODEL` (default `claude-sonnet-5-5`).
With `ANTHROPIC_API_KEY` set it calls the Messages API. Without it, it runs
each turn through the Claude Agent SDK on the machine's Claude Code login.

On that transport Claude Code knows the tools only as `mcp__oppenheimer__<name>`.
A call by the bare name (`send_to_session`) is answered "No such tool", and
some runs give up there.

- Such a run, in which no write reached its tool, says nothing about
  restarting, so it is run again, up to 6 times.
- The summary says how many were re-run.
- A run still lost after the last try is marked `u`.

| Mark | Meaning |
| --- | --- |
| `R` | restarted the session |
| `S` | sent the prompt |
| `T` | told the person |
| `O` | told the person to open the session |
| `r` | restarted a session that was running |
| `x` | restarted against a close the person asked for |
| `u` | gave up after a bare-name call, on every try |
| `-` | said nothing |

Every run is written to `reports/`, which git ignores.
