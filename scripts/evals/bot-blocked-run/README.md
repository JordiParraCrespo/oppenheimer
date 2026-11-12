# Bot blocked run eval

Does a bot solve a blocker a routine's run meets, when a way round makes
sense?

On 2026-11-12 the owner saw Oppie answer its half-hourly Sentry check with
"the designated session is still closed" for hours, and asked: "if the
session is closed create a new one, no?". Since then
(`product/versions/mvp/25-bots.md` §1, `26-bot-routines.md` §4):

- a blocker is the bot's to solve before it is the bot's to report: it asks
  what the blocked step was for and reaches that end another way, when the
  way round serves the same purpose, stays within its permissions and
  instructions, and nobody said no to it;
- the same blocker is never reported twice: with no way round the person is
  told once, and later runs stay quiet until something changes.

The rule is stated once, in
`apps/api/src/bots-chat/domain/bot-recovery.policy.ts`. It reaches the model
through "How a turn goes" in the system prompt and the note that opens a
routine's or a loop's run (`repeatedBlockerAsk`). A change to either is
what this eval is for.

## The cases

`cases.json` holds Oppie twice (free to start sessions, and told to use only
the Sentry watch session), the routine and 6 cases. Each case is one run of
the routine:

| Case | The run | A right run |
| --- | --- | --- |
| `closed-first-time` | the session the routine names is closed | starts a new session |
| `closed-said-so-for-hours` | the screenshot: closed, and eight earlier "still closed" replies | starts a new session |
| `open-session` | the session is at its prompt | prompts it, starts none |
| `told-only-that-session` | closed, and the instructions say never to start another without asking | starts none, tells the person |
| `told-only-that-session-already-said` | the same, and the person was already told | starts none, writes nothing (open, see Results) |
| `named-host-offline` | the routine names a host, which is offline, and another is online | starts nothing on the other host |

Add a case whenever a bot stops at a blocker it could have solved, or
solves one in a way that made no sense.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-blocked-run                          # every case, 3 runs each
pnpm eval:bot-blocked-run --case closed-first-time # one case
pnpm eval:bot-blocked-run --runs 5
```

Each run builds the bot's real system prompt (`composeBotSystemPrompt`) and
the real routine opening (`routineOpening`). It offers the production
session tools over the in-memory workspace (`../bot-workspace.ts`), bound
under Approve for me, so `start_session` raises a card and runs nothing;
`send_to_session` answers a closed session as the API does (`SESSIONS_005`);
`notify` and `nothing_to_report` are the production definitions over
stand-ins. The earlier runs' replies open the message as a list, since the
eval's transport sends one message. A run is scored on its calls and, for
a quiet run, on writing nothing at all (`scoreRun`). A case marked `open`
in `cases.json` is known to fail: it is run and reported, and does not
fail the eval.

The model is `BOT_BLOCKED_RUN_EVAL_MODEL` (default `claude-sonnet-5-5`).
With `ANTHROPIC_API_KEY` set it calls the Messages API; without it, it runs
each turn through the Claude Agent SDK on the machine's Claude Code login
(`../bot-turn.ts`).

It prints a line per case, one mark per run:

| Mark | Meaning |
| --- | --- |
| `S` | started a session |
| `s` | started one it should not have |
| `H` | kept to the host the routine names |
| `P` | prompted the session it was given |
| `T` | told the person |
| `Q` | stayed quiet |
| `r` | said the blocker again |
| `-` | did nothing |

Then it prints the totals and writes every run to `reports/` (ignored by git).

## Results

| Date | Wording | Model | Right | Stopped at a blocker | Started what it should not | Said it again |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-12 | `main` before (routes for a failed step only) | claude-sonnet-5-5 | 12/15 on the first five cases (`closed-said-so-for-hours` fails 0/3) | 3 | 0 | 0 |
| 2026-11-12 | the blocker rule, in the prompt and in the run's opening | claude-sonnet-5-5 | 25/30 at 5 runs (the open case 0/5) | 0 | 0 | 5 |

On the old wording a first run already started a new session; it was the
chat full of the bot's own "still closed" that made every later run write
one more.

The open case: told once and still blocked, the bot calls
`nothing_to_report` and then writes the blocker again, in every run and on
every wording tried (the opening's, and a sterner answer from the tool).
The first row scored that as quiet, because it looked only at the call.
Silence has to be enforced where the turn is stored (a turn that called
`nothing_to_report` keeps no message), which is its own change.

Both runs went through the Claude Code login. The bot in the
screenshot ran on another provider's model, which this eval cannot call.
