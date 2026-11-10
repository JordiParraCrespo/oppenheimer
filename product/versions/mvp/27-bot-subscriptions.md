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
working: the stall check (§4.1) wakes the bot once for it. A task ending is
told apart from a session merely stopping, because what wakes is the **turn**, not the session's lifecycle:
a session stopped after its task completed already woke the bot on
`completed`, and its stop moves no live turn, so it wakes nothing more.

**Once per state per task.** The wake's key is
`subscription:<subscriptionId>:<turnSeq>:<state>`, so a task that blocks,
works and blocks again wakes the bot once for input; Claude Code's
permission prompts would otherwise wake it on every tool call.

**What a terminal prints** (2026-10-29, from Grok Bot's shell watches,
`research/lessons-from-grok-bot.md` §9 row 8). `watch_session` takes a
`pattern`, a regular expression of at most 200 characters with no
lookaround or backreference. The runner matches it line by line on the
session's pane, on the host. A match wakes the bot with the pattern and
how many lines have matched so far, never the lines: pane text still never
reaches Postgres, so the bot reads the session to see what happened. The
runner sends `terminal.matched` with `{ watchId, count }` (the first match
at once, then at most one every few seconds). The wake's key is
`subscription:<id>:match:<watchId>:<count>`, so a count that comes back
twice wakes the bot once, and a pattern that replaces another counts afresh. Each match counts against the subscription's 20 wakes. A
session holds at most 10 watched patterns (`SESSIONS_043`), and an invalid
pattern is `SESSIONS_042`. The sessions module owns what the runner is told
(`session_terminal_watch`), and it sends that again on every hello, since a
runner keeps watches in memory. It sends each watch with the newest count
reported for it: a runner that still holds the watch keeps it as it is, and
one that restarted counts on from that count, so no match is lost below
what the bot was already told. The API refuses what Go's `regexp` would:
lookaround, backreferences, unknown escapes and repeats past 1000. The subscription owns who is woken. When
the task ends and its pattern never matched, the wake says so: "it never
printed a line matching …".

**Waiting inside a turn.** `wait_for_session` blocks, for at most 120
seconds, until the session's task stops for something a watch wakes for,
or the session is closed. It does this at most 3 times a turn, because a
turn stops after 4 minutes. A longer wait is a watch.

## 3. Subscribing

| How | Watches | Ends |
|---|---|---|
| `start_session` (subscribes by default; `watch: false` opts out) | the session's first task, even one that ended before the watch was stored: the wake is asked for once at once, so a launch that failed straight away is told | when that task ends |
| `send_to_session` (subscribes by default; `watch: false` opts out) | the task its prompt opened, by number | when that task ends |
| `answer_session` (subscribes by default; `watch: false` opts out; 2026-11-10) | the task it unblocked, by the number read before the answer went: the input it answered counts as known, so what follows wakes it, an end that came before the watch was stored included | when that task ends |
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
- **What says stuck** (`checkFor`, pure, since §4.2). The task is still `queued` (it
  never started), or it is an interactive task on a host, `in_progress`,
  whose agent was never seen working. A headless or cloud task reports its
  own progress, so the screen is no evidence for it. Anything else is
  silent: a task seen working, one that moved on, ended or asks for input
  (the wakes tell those), one the bot was already woken for, a session
  closed.
- **What it does.** A third cause in the one wake model, beside a task's
  state and a terminal match (`SessionWakeCause`): a turn like a wake's, keyed
  `subscription:<id>:<seq>:stalled`, so a retried job tells the bot once,
  opened by a `session` event whose state is `stalled`. The bot reads the
  session and tells the person what looks stuck and what would get it going;
  it does not restart, stop or prompt the session on its own. The check
  records nothing on the subscription, so the task's end still wakes the bot.
- **Cost.** One read per task handed off, and a turn only when it is stuck.

### 4.2 Looking at the work, every few minutes

The wakes and the stall check speak for a task that changed state or never
got going. A task that got going and then drifts (the agent idle at its
prompt without the task folding to an end, going in circles, off the task,
waiting on something the screen does not show as a question) told the bot
nothing, and the owner had to say "you should be babysitting this"
(Facturas, 2026-11-10). A person who delegates does not wait to be told it is
done: they look over the work every so often. So does a bot now:

- **When.** The stall check is the first of up to six checks of the task
  (`BOT_PROGRESS_CHECKS_PER_TASK`): at five minutes, then every ten
  (`BOT_PROGRESS_CHECK_INTERVAL_MS`), the last at 55. Each stages the next
  while the task is live. Past that the bot's hourly heartbeat
  (`26-bot-routines.md` §6) covers it with everything else it looks after.
- **What it decides** (`checkFor`, pure). A stall, as §4.1, first, once. A
  task still `queued` or `in_progress` otherwise wakes the bot for a look,
  once per check (`subscription:<id>:<seq>:progress:<n>`), whatever its drive
  or place: what the agent has done is in its transcript, not its state. A
  task waiting on a person, or whose stall was told, is looked at again later
  without a wake. A task over, superseded or a session closed ends the checks.
- **What the bot does.** Reads what the agent did (`read_session_transcript`,
  else `get_session`) against the task. On track: `nothing_to_report`, so the
  chat shows only "Checked on session *name*". Off: it tells the person in a
  sentence or two, with `notify`, and may nudge the agent with
  `send_to_session` when its instructions settle what it needs, asking first
  as always. It never stops or restarts the session on its own.
- **Asked.** "Monitor it" or "how is it going" is a look now, not "I already
  follow it": the prompt no longer says checking adds nothing.
- **Which tasks** (2026-11-10). Every task the bot followed while it runs:
  one it handed off (`start_session`, `send_to_session`), one it unblocked
  (`answer_session`), and one it chose to `watch_session` while that task is
  queued or running (`liveTaskOf`). Until then a watched task was looked at
  only at its end, so a bot that read a session it had not started and
  told the owner it would check once the agent pushed was never woken for
  it (Facturas, the same evening).
- **A look the bot asks for** (2026-11-10). `watch_session` takes
  `check_in_minutes` (1 to 60): one more look at the running task at that
  time, for when it told the person it would check back then. It is a
  check like the others, numbered by the minute it is due
  (`requestedCheckNumber`), so it never shares a key with a regular check
  already delivered and stages none after it. A task not running sets
  none, and the answer says so: its end, or the next task, wakes the bot.
- **Promises** (2026-11-10). The prompt says never to tell the person the
  bot will check back, report or carry on once something finishes unless
  something will wake it for it: the sessions it started, prompted or
  unblocked are followed already, any other it `watch_session`s before its
  turn ends. Nothing else brings a bot back but the hourly heartbeat.
- **Cost.** Up to six short turns per task followed, most ending quiet,
  and one per look the bot asks for.

Codex, for comparison (`codex-rs`, 2026-11-10): its parent pulls, with
`wait_agent` (30 s by default, up to an hour) and `list_agents`, and learns a
subagent's end as a note on its next turn; it has no timer that looks at a
running subagent, and its prompt says to wait "very sparingly". A bot is a
chat the person leaves, not a turn that blocks, so ours looks on a timer.

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

### 7.1 As built: `pull_request` (2026-11-03)

The plan above held, with three changes it did not foresee: the event is
the inbound-events hub's, not the pull-requests module's; the wake is the
event's metadata, not a fresh read; and a close without a merge wakes
nothing yet. A session's agent already watched pull requests the same way
(`../../next-steps/agent-tools.md` §3); this is its bot side, and the two
share their words (`github/domain/github-pull-event.policy.ts`).

- **The subject.** `"resourceKind"` gains `pull_request`. A pull request is
  not ours and has no uuid here, so `"resourceId"` is null for one and the
  row names it by `"githubRepoId"` (`bigint`), `"pullNumber"` and
  `"repositoryFullName"`, the `owner/name` it had when watched, for the
  list and the wakes. `CHK_bot_subscription_subject` ties the columns to
  the kind: a session names a session alone; a pull request names all
  three, no session, `until` `closed`, and no terminal watch.
  `UQ_bot_subscription_bot_pull_request` holds one per bot and pull request,
  and `IDX_bot_subscription_pull_request` serves the webhook's read, both
  partial on the kind (`1793707588046-AddBotPullRequestSubscriptions`).
- **The tools.** `watch_pull_request { repository, number, purpose? }`,
  `repository` as `owner/name` or the id `list_repositories` gives, and
  `unwatch_pull_request { repository, number }`, listed under GitHub in
  Settings, Permissions (`pulls:read`). A watch looks for the repository
  among those the workspace's usable installations cover, read as the
  owner, then reads the pull request as the owner: a repository the owner
  cannot read, a number that is not a pull request, or one already merged
  or closed is refused and nothing is stored. Neither asks, as
  `watch_session` does not. `list_watches` lists both kinds. The limits
  are the session's: 20 wakes a subscription, and 50 subscriptions a bot,
  sessions and pull requests together. Watching again keeps the row, its
  id and its wakes.
- **What wakes it.** The GitHub events the hub stores, on that repository
  id and number in the event's workspace: `check_failed`, `check_passed`,
  `review`, `comment`, `pr_merged` (`PULL_REQUEST_WAKE_EVENTS`, shared with
  a session's agent). Our own app's events, an event with no pull request
  number, or one about an issue wake nobody.
  `BotPullRequestWakeDomainEventHandler` listens to
  `ExternalEventReceivedDomainEvent` with `suppressErrors: false`, and
  dispatches `WakeOnPullRequestCommand` per subscription; one that fails is
  thrown after the others ran, for the outbox to deliver again.
- **The wake.** The thin-event rule of §1 does not carry over: GitHub is
  not ours to re-read as the owner on every event. The wake re-resolves the
  bot and its owner (gone, or no longer a member: it ends, `access_lost`),
  and is otherwise made of the event's metadata alone, each field held to
  the characters GitHub allows: the kind, the number, the repository, a
  check's name and conclusion, a review's state and the actor's login.
  Never a comment's or a review's words: the bot is told to read the pull
  request with `get_pull_request`. Its key is
  `subscription:<id>:github:<inboundEventId>`, so a redelivered event is
  one turn, and a turn found already queued is not counted again. It opens
  with an `event` message of kind `pull_request` (the subscription, the
  repository id and name, the number and what happened), drawn in the chat
  as one line ("Pull request #128 of acme/app: checks failed"). A merge is
  the last wake: the subscription ends after it.
- **Outside text, and the owner's call (2026-11-03).** A watch lets anyone
  who can comment on the pull request start an unattended turn, and the bot
  reads that comment with its whole toolbox: `web_fetch`, mail and session
  reads included, none of them asking first under `auto`. Codex's security
  review proposed narrowing such turns (only that pull request's reads and
  `notify`) or making their outbound and private reads ask first. The owner
  chose full autonomy: a bot should act on what it reads (a comment, later a
  WhatsApp message) the way it acts on its owner's words, up to starting a
  session. The turn keeps every tool, and the defence is the prompt, an
  accepted risk: each comment and review names its author as a collaborator
  or as outside the repository (GitHub's `author_association`), outside
  text stays fenced, and the rules name what an injection asks for and
  forbid putting the person's private information where outside text
  points. Narrowing by author (a collaborator's words drive the bot, a
  stranger's ask first) and a tool-less reader in front of the bot are the
  options on file if that changes.
- **Not yet.** GitHub's normalizer makes no event of a pull request closed
  without a merge, so such a subscription stays until it is unwatched or
  reaches its wake limit; a `pr_closed` type in the catalog is what would
  end it. A repository renamed on GitHub is still found (by id), under its
  old name in the list.

## 8. Visibility

- `list_watches` shows the bot its active subscriptions: session, purpose,
  until, wakes so far, since when; and, since §7.1, the pull requests it
  follows.
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
- **C. More kinds**: automation runs, then pull requests (§7). Pull
  requests were built first, 2026-11-03 (§7.1).

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
- 2026-11-10: **a bot looks at the work it handed off every few minutes**
  (§4.2): the stall check is the first of six checks, each a quiet wake
  while the task runs. It changes the 2026-10-29 "there is still no
  progress update" and §2's "`in_progress` never wakes" for a task the bot
  handed off; the person still hears only when something is off.
- 2026-11-03: **a bot follows a pull request** (§7.1). The wake is the
  GitHub event's metadata, not a re-read as the owner: it changes §1's
  "the event is thin, the read is fresh" for this kind, because the pull
  request is GitHub's. The event comes from the inbound-events hub, not the
  pull-requests module §7 named, and a close without a merge does not end
  the subscription yet.
