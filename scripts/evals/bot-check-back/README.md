# Bot check-back eval

Does a bot come back to async work it waits on, and at a look speak only
when something moved?

On 2026-11-23 Oppie started a release session, said it would verify the
release before calling it done, and went silent until the owner asked "Have
you finished?". Since then a bot sets its own look with `check_back` on
anything it delegates or waits on (`product/design/bots/bot-subscriptions.md`
§7.3), and a look speaks only when the work moved or needs help.

## The cases

`cases.json` holds Oppie, a release session in three states (where the
bot's last line left it, moved on since, finished) and 7 cases:

| Case | Kind | A right run |
| --- | --- | --- |
| `deploy-wait` | the person started a deploy elsewhere and asks to hear it comes up healthy | sets a look (or starts a session to watch, which is followed) |
| `waiting-on-person` | waiting on a colleague to push a contract by 6 | sets a look |
| `ci-on-main` | CI on main is running; tell me if it goes red | sets a look, or starts a read-only session to watch it (followed by default) |
| `quick-answer` | which hosts are online | sets none |
| `look-nothing-moved` | a look's turn; the release is where the last line left it | keeps no words, sets the next look |
| `look-moved` | a look's turn; the release moved on | one line where it stands, sets the next look |
| `look-done` | a look's turn; the release is live | reports it, sets no more |

A look's turn opens with the production opening and ask
(`wake/check-back.md`, `checkBackPrompt`), after the bot's last line about
it, since the eval's transport sends one message.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-check-back                        # every case, 3 runs each
pnpm eval:bot-check-back --case look-moved      # one case
pnpm eval:bot-check-back --runs 5
```

Each run builds the bot's real system prompt and serves the production
session tools over the in-memory workspace (`../bot-workspace.ts`), the
production `check_back` over a stand-in store (its answers, refusals and
chain as production reads them), and `notify` and `nothing_to_report` over
stand-ins. A run is scored on its `check_back` calls and on the words the
chat keeps of it (production's `QuietTurn`). The model is
`BOT_CHECK_BACK_EVAL_MODEL` (default `claude-sonnet-5-5`), on the Messages
API with `ANTHROPIC_API_KEY`, else the machine's Claude Code login.

Marks: `B` set a look, `F` started a session to follow it instead, `-` set
nothing for pending work, `.` rightly set none, `b` set one it should not,
`Q` kept no words and set the next look, `s` spoke at a look where nothing
moved, `S` spoke and set the next look, `q` stayed quiet though it moved,
`R` reported the end and stopped.

## Results

| Date | Wording | Model | Right | Notes |
| --- | --- | --- | --- | --- |
| 2026-11-24 | the first `check_back` look prompt ("call nothing_to_report and write nothing") | claude-sonnet-5-5 | 18/21 at 3 runs | `look-nothing-moved` 0/3: "Nothing has changed since my last update…" every run |
| 2026-11-24 | the quiet branch said outright: no line at all, not "nothing new" | claude-sonnet-5-5 | 29/35 at 5 runs | `look-moved` 0/5: the case's progress was only in log notes, which `read_session` names but does not show; the bot read state with `get_session` and saw nothing move |
| 2026-11-24 | two branches (write and do not call nothing_to_report, or write nothing and call it); read_session and the transcript for progress; the cases carry the agent's transcript | claude-sonnet-5-5 | 33/35 at 5 runs | every case passes; one deploy run set nothing, one quiet look spoke |

Two things found on the way, outside the prompt:

- `get_session` failed in every eval that serves it, because
  `BotHostToolsFactory` and `BotSessionToolsFactory` now take the session
  link resolver and the shared workspace built them without one; the
  workspace now gives them production's resolver over a stand-in config.
  `bot-session-follow` is 12/12 on it.
- A note an agent sends (`runner sessions notify`, `agent.notified`) wakes
  a bot that follows the session, but `read_session` shows it as its kind
  only, without its words, so a look reading the log cannot see it.
