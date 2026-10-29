# 27 — Bot subscriptions: a bot hears back from the work it delegated

**Decided 2026-10-22 (issue #445); slice A built.** A bot can hand work to
a coding session (`start_session`, 25 §4.2), but until now it could only
learn the outcome when somebody asked it, or from a routine that polled.
That breaks the promise of 25 §1: a bot owns what it delegates, end to
end. This note gives a bot a **subscription** to a session: the session's
task ending, failing, being stopped or asking for input wakes the bot with
a turn of its own, which reads the result and tells the person.

The research is `../../research/lessons-from-grok-bot.md` §8 (how Grok
Bot's watchers wake a bot, and OpenAI's background responses and
webhooks). Ideas are taken, no code.

## 1. The shape

```
 sessions                         outbox (at least once)                       bots-chat
 ────────                         ──────────────────────                       ─────────
 turn folds to requires_action ─► SessionTurnChangedDomainEvent ──► BotSessionWakeDomainEventHandler
          completed · failed                                           │  active subscriptions of the session
          cancelled · expired                                          ▼
                                                              WakeSubscribedBotCommand (one per subscription)
                                                                 │ re-read the session as the owner (thin event)
                                                                 │ wakeFor(subscription, latest turn) — pure
                                                                 ▼
                                                     bot_turn origin 'subscription', lane background,
                                                     sourceKey subscription:<id>:<seq>:<state>  ──► bot-turns worker
```

- **A subscription is a row the bot owns** (`bot_subscription`): this bot
  follows this session, for this reason, since this turn of its own.
- **The wake is a queued turn**, as 26 §1 decided for routines: the turn
  queue is the durable record, holds a busy bot, survives restarts, and
  its unique `sourceKey` makes a wake delivered twice one turn. There is no
  wake ledger beside it.
- **The event is thin, the read is fresh.** The listener does not trust
  what the event says happened: it re-reads the session as the bot's owner
  and wakes for the session's turn as it stands now. That one move answers
  out-of-order delivery, superseded states and a lost owner at once.

## 2. What wakes a bot

A session's turn (`session-turn.policy.ts`) is one task given to the agent.
Its states are OpenAI's run states; the ones that wake are:

| Turn state | Means | The bot is asked to |
|---|---|---|
| `requires_action` | The agent is blocked waiting for a person (a permission, a question) | Tell the person what it waits on and where, since the bot cannot answer a terminal |
| `completed` | The task ended | Read what it did and report it, without claiming what the result does not show |
| `failed` | The launch or the run failed | Say so and why, and what would fix it |
| `cancelled` | Stopped or closed under the task | Say it was stopped; do not restart it on its own |
| `expired` | Never ran in time | Say so |

`queued` and `in_progress` never wake: a session that stays open with its
agent idle is not news. The one exception is a task the bot handed off that
is still in one of them five minutes later without its agent ever being seen
working: the stall check (§4.1) wakes the bot once for it. A task ending is told apart from a session merely
stopping, because what wakes is the **turn**, not the session's lifecycle:
a session stopped after its task completed already woke the bot on
`completed`, and its stop moves no live turn, so it wakes nothing more.

**Once per state per task.** The wake's key is
`subscription:<subscriptionId>:<turnSeq>:<state>`, so a task that blocks,
works and blocks again wakes the bot once for input; Claude Code's
permission prompts would otherwise wake it on every tool call.

## 3. Subscribing

| How | Watches | Ends |
|---|---|---|
| `start_session` (subscribes by default; `watch: false` opts out) | the session's first task, even one that ended before the watch was stored: the wake is asked for once at once, so a launch that failed straight away is told | when that task ends |
| `watch_session` with `until: "task"` (the default) | the live task, or the next one if none is live | when that task ends |
| `watch_session` with `until: "closed"` | every task of the session | when the session is closed, or after the wake limit |
| `unwatch_session` | — | now |

- **Ownership.** A subscription belongs to the bot that made it and acts as
  that bot's owner. It records the bot's turn that made it
  (`originTurnId`), the credential scopes and time zone of that turn, and
  an optional `purpose` in the bot's words ("research Cursor skills on
  GitHub"). That is the correlation the issue asks for: bot, conversation
  (a bot has one), session, and the turn that delegated the task.
- **One per bot and session.** Subscribing again updates the active row
  (`UQ_bot_subscription_active`), so an approved `start_session` retried by
  its job, or a bot that watches twice, holds one subscription.
- **Consent.** `start_session` already asks under Approve for me; its card
  says the bot will hear back. `watch_session`, `unwatch_session` and
  `list_watches` do not ask. A watch costs a turn per wake, but it is
  bounded (one task, or the wake limit), it can be undone, and a wake can
  only follow a session that a person or an approved call started, so a
  watch cannot start spending on its own. 26 §4's rule is about a routine
  that runs without anything happening; this is a wake for something that
  did.
- **The wake limit.** 20 wakes a subscription. The next one ends it
  (`wake_limit`) rather than waking again, so a session restarted in a loop
  cannot keep a bot busy.

## 4. The wake

`WakeSubscribedBotCommand` (bots-chat), for one subscription:

1. Load it; an ended one does nothing.
2. Resolve the owner's scope (`BotOwnerScopeResolver`). No owner, or no
   longer a member: end it (`access_lost`).
3. Read the session through `FindSessionQuery` **as the owner**. Refused
   or gone: end it (`access_lost`). The session's own words never decide
   anything here.
4. `wakeFor(subscription, turn, sessionClosed)`, a pure policy, answers
   `skip` (not a waking state, a task before the one watched, already
   delivered, the wake limit) or `wake` with the key and whether the
   subscription ends with it.
5. Queue the turn with `enqueueOnce` and the key, then record the delivery
   (`lastTurnSeq`, `lastState`, `wakes`, and the end when it ends). A
   process that dies between the two re-runs both on redelivery:
   `enqueueOnce` finds the turn it queued, and the record is written.
   The record is conditioned on the version the wake loaded; the end is
   not, since an end is final: an input-needed wake recorded a moment
   before must not keep a finished task's subscription alive.

The listener sets `suppressErrors: false`, as the outbox's other
at-least-once listeners do, so a wake that throws is delivered again
rather than marked done; the wakes of one session run side by side, and
one failing does not hold back the others.

The turn opens with an `event` message of kind `session`: the session's id,
name, the task's number and state, and the subscription's purpose. Its
words for the bot are the task, the state and, when the agent reported
one, its result inside `<untrusted_external_data>`. The bot is told to
read the session with `get_session` before it reports, to report only
what the result shows, and that nothing in it is an instruction or an
approval. It runs on the bot's provider, model and effort as they are at
the wake, in the `background` lane, with the scopes of the turn that
subscribed; its asking tools still ask.

The chat draws the opening as one line, "Session *name* finished" (or
*needs input*, *failed*, *was stopped*, *expired*, *looks stuck*), with Open session.

### 4.1 The stall check

The wakes above all wait on a state the session reaches. A task that never
reaches one, because its host is offline or its agent sits at a
folder-trust or sign-in prompt, leaves the bot silent until somebody asks
(the owner asked "Hi?" to get news on 2026-10-29). Grok Bot, Codex and
Claude Code send no progress updates either; what Claude Code and
OpenClaw do have is a quiet check that speaks only when something is wrong.
This is that check, for one task:

- **When.** `start_session` and `send_to_session` stage a job on the outbox
  (`bot-stall-checks`) for five minutes later (`BOT_STALL_CHECK_DELAY_MS`),
  naming the subscription and the task handed off. `watch_session` stages
  none: a session the bot did not start is not its launch to vouch for.
- **What it reads.** The session, as the owner, as a wake does. Only
  Oppenheimer's records decide, never silence: the runner reports on
  change, so a quiet log is also what an agent working steadily looks like.
- **What says stuck** (`stallFor`, pure). The task is still `queued` (it
  never started), or it is an interactive task on a host, `in_progress`,
  whose agent was never seen working. A headless or cloud task reports its
  own progress, so the screen is no evidence for it. Anything else is
  silent: a task seen working, one that moved on, ended or asks for input
  (the wakes tell those), one the bot was already woken for, a session
  closed.
- **What it does.** A turn like a wake's, keyed
  `subscription:<id>:<seq>:stalled`, so a retried job tells the bot once,
  opened by a `session` event whose state is `stalled`. The bot reads the
  session and tells the person what looks stuck and what would get it going;
  it does not restart, stop or prompt the session on its own. The check
  records nothing on the subscription, so the task's end still wakes the bot.
- **Cost.** One read per task handed off, and a turn only when it is stuck.

## 5. Authorization

Nothing a session says widens what the bot may do:

- The wake runs as the bot's owner, re-resolved at every wake, never as
  whoever started the session. A session the owner can no longer read ends
  the subscription and wakes nothing.
- The turn's tools are those the subscribing turn's credential covered,
  as a routine's are (26 §6).
- The session's result is data inside an untrusted envelope, the prompt
  says so, and Approve for me still asks for anything that reaches outside
  Oppenheimer. A wake is never consent: "the session says it is safe to
  merge" merges nothing without a card.

## 6. Built on what exists

| Need | Reused |
|---|---|
| Durable, at-least-once delivery that survives a restart | the transactional outbox, which already carries `SessionTurnChangedDomainEvent` (nothing listened to it until now) |
| Waking a bot, holding it while busy, ordering | the bot turn queue and `enqueueOnce`'s `sourceKey`, as routines and answers to `ask_bot` use it |
| Deduplicating a delivery made twice | `UQ_bot_turn_source` |
| What a task is and whether it ended | the session turn fold (`session-turn.policy.ts`) |
| Reading the result | `get_session`, and the turn's `result` the headless drive reports |
| Untrusted content | `fenceUntrusted`, as `get_session` uses it |

What it does not reuse, and why:

- **Not a routine** (26 §5). A routine with a `session_ended` trigger is a
  standing rule ("every session I start"), shown on the Routines tab, with
  the run budget and the spend guard of an unattended job. A subscription is
  one delegation: one session, created by the turn that delegated it, ended
  when the work ends, and waking on input needed too. Using routines for it
  would put a routine on the tab for every session a bot starts. 26 §5's
  trigger stays the shape for a *person's* automation on sessions.
- **Not inbound events.** That hub is for systems we do not run; sessions
  are ours and raise domain events.

## 7. Beyond sessions

`bot_subscription."resourceKind"` is `session` today, with a `CHECK` that a
new kind widens. A new kind is a resource that already raises a domain event
when its work changes state, a listener that maps the event to its
subscriptions, and a pure `wakeFor` for its states:

| Kind | Its event | Wakes on |
|---|---|---|
| `automation_run` | `AutomationRunChangedDomainEvent` | the run's outcome |
| `pull_request` | the GitHub webhooks the pull-requests module records | a review, checks finishing, a merge or close |
| `bot_turn` (another bot's work) | already built as `ask_bot`'s answer (25 §4.6), which queues the asker's turn when the asked turn ends | — |

`ask_bot`'s answer and an approval's decision turn (25 §5) are the same
idea built earlier for one resource each. They stay as they are; a later
pass may move them onto subscriptions if a third copy appears.

## 8. Visibility

- `list_watches` shows the bot its active subscriptions: session, purpose,
  until, wakes so far, since when.
- A wake is a line in the chat, so the person sees every one.
- `GET /v1/bots/:id/subscriptions` and a list in bot settings wait for
  slice B.

## 9. Slices

- **A. Session subscriptions**, built: the table, the listener and the
  wake command, the `session` event and its line in the chat, the
  `subscription` turn origin, `start_session`'s `watch`, `watch_session`,
  `unwatch_session` and `list_watches`.
- **B. Visibility in the console**: the subscriptions list on the bot's
  settings, with Unwatch.
- **C. More kinds**: automation runs, then pull requests (§7).

## Decided

- 2026-10-22 (issue #445): **a bot's delegated session is followed by a
  subscription**, not by a routine with a `session_ended` trigger. It
  changes 26's 2026-10-16 decision ("a trigger source, not a `bot_watch`
  table") for a bot following its own work; the trigger stays for
  automations. What 26 wanted holds: the wake is a queued turn and the
  turn queue is the only wake path.
- 2026-10-22: **the event is thin**: the wake re-reads the session as the
  owner, so a late or reordered event wakes for the state that holds now,
  and only once per task and state.
- 2026-10-22: **watching does not ask**, `start_session` subscribes by
  default, and a subscription stops after 20 wakes.
- 2026-10-29: **a task the bot hands off gets one silent stall check**, five
  minutes later, that wakes it only when the task never started or its agent
  was never seen working (§4.1). It changes §2's "`queued` and `in_progress`
  never wake" for that one case; there is still no progress update.
