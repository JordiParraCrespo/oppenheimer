# 26 — Bot routines: how a bot wakes on its own

**Decided 2026-10-16, in review; built in the slices of §8. Built so
far: slices A, B and the tab of C**: the run-target port, bot routines in
the API (a bot saves and runs its routines from chat), and the Routines tab. Note 25
builds a bot that only works when you write to it. This note is how it
works when you do not: on a schedule (its heartbeat), on an event, or
when a session ends. The 2026-10-13 export already draws it:
`BotSettings.dc.html` has a **Routines** tab whose rows are a name, a
*when*, a prompt and an on/off switch, with three kinds of *when*:
a schedule ("Weekdays at 09:00"), a GitHub event ("When a PR is opened in
atlas") and a session ("When a session linked to a task ends").

The research is `../../research/lessons-from-grok-bot.md` §7 (Grok Bot
0.71.2's routines, read from the shipped client on 2026-10-16) and
OpenClaw's heartbeat (`lessons-from-synara-and-openclaw.md`). Ideas are
taken, no code.

## 1. The shape

A bot never wakes itself. **A routine is an automation whose run target
is a bot**, and its run is a **turn** of that bot, queued like a message
of yours and opened by an `event` message, exactly as an approval
decision opens one today (`bot-approval.policy.ts`, `decisionTurn`).
There is one seam and one path:

```
 schedule tick ──┐                                              ┌─ SessionRunTarget   a session on a host (slice A)
 GitHub event  ──┼─► automations: match → firing → guards ──────┤   AutomationRunTarget port
 session ended ──┤   (one trigger catalog, one runs list)       └─ BotRoutineTarget   a queued turn of the bot
 Run now ────────┘                                                        │
                                                                          ▼
                                                     bot_turn (origin 'routine', sourceKey) → bot-turns worker
```

- **No second scheduler.** Note 16 already has the schedule tick, IANA
  zones, DST rules, missed-slot grace, the inbound-events hub, the guard
  chain, revisions, rate limits and the runs list; a routine reuses all
  of it and differs only in what a run *is*.
- **No second queue.** The bot's turns are already a durable FIFO with
  busy handling (`bot-turn.repository.ts`: `enqueueWithin`, `stageNext`):
  a turn waits as `queued` while another runs, and the end of one stages
  the next. A routine's run is one more queued turn, so durability,
  restarts and "the bot is busy" need nothing new.
- **One event-to-wake path.** "When a session ends" is a trigger source
  of automations (§5), not a watch table beside them.

## 2. Patterns, and why each

| Pattern | Where | Why |
|---|---|---|
| **Port and adapters** (hexagon) | `AutomationRunTargetPort`, with `SessionRunTarget` and `BotRoutineTarget` | Automations never imports bots-chat. A third target later (a Slack reply, a webhook call) is an adapter, not a branch in the dispatcher |
| **Registry by contribution** | `AutomationsModule.contributeRunTargets([...])`, the shape of `InboundEventsModule.contributeSources` | The module that owns a target registers it; the registry refuses a duplicate at boot and fails loudly on a kind nobody contributed |
| **The target owns its whole run** | `decide` → `launch` → a `RunDispatchRef` the run records | The handler records a ref without reading its kind, so a new target changes the ref's union and the run's persistence, never the dispatcher |
| **Idempotent enqueue** | `bot_turn."sourceKey"`, unique per bot | A run the queue dispatches twice finds the turn it already queued, the same key note 16 §3 writes down for every hop (`automation-run:<runId>`) |
| **Guards as pure policies** | note 16's guard chain, plus what `BotRoutineTarget.decide` adds | Same contract (`allow`, `skip(reason)`, `defer(until)`); each is a function with a table test |
| **Domain events, not reads across modules** | automations subscribes to `SessionTurnChangedDomainEvent` | Sessions raises it for "a consumer that owns a turn's reason"; nothing subscribes yet, and this is the first |

## 3. The run-target port (automations)

```ts
// automations/application/automation-run-target.port.ts
export interface AutomationRunTargetPort<TInput = unknown> {
  readonly kind: AutomationRunTargetKind;
  /** Its own guards, then what to launch. */
  decide(context: RunTargetContext): Promise<RunTargetDecision<TInput>>;
  /** Carry the run out as the owner; idempotent on the run's id. */
  launch(context: RunTargetContext, input: TInput): Promise<RunDispatchRef>;
  /** What a refusal thrown by `launch` means for the run; null for a fault. */
  refusalOf(error: unknown): RunRefusal | null;
}

// automations/domain/automation.types.ts — what a run records
export type RunDispatchRef = { kind: 'session'; sessionId: string } | { kind: 'bot_turn'; turnId: string };
```

- `RunDispatchResolver` runs the guards every run shares (deleted,
  paused, stale, the owner's scope), then the target's. What it hands the
  handler is a launch already bound to its target and input, so no
  `unknown` reaches the handler.
- The handler records `run.dispatched(ref, revisionId, at)` without
  reading the ref's kind, and maps a refusal through the target.
- The host's capacity, disk and slot claim live in `SessionRunTarget`,
  since only a session holds a place on a host.

### What an automation records

| Change | Why |
|---|---|
| `automation."runTarget"` (`session` \| `bot`, not null, default `session`) | The dispatcher picks the adapter from it; it never changes over an automation's life, so it is on the automation, not the revision |
| `automation."botId"` (nullable, FK to `bot` `ON DELETE CASCADE`), `CHECK (("runTarget" = 'bot') = ("botId" IS NOT NULL))` | "The routines of this bot" is the Routines tab's one read: index `("organizationId", "botId") WHERE "botId" IS NOT NULL`. A bot's routines go with it |
| `automation."projectId"` nullable, `CHECK ("runTarget" = 'bot' OR "projectId" IS NOT NULL)` | A bot's heartbeat belongs to no project, and must not be deleted with an unrelated one. A session automation still needs its project |
| `automation_revision` session fields (host, agent, model, permission, repositories) nullable, with a `CHECK` per target | A bot routine's revision is its prompt; it runs on the bot's provider, model and effort **as they are at the run**, like an approval's turn |
| `automation."credentialScopes"` jsonb, nullable | The scopes of the credential that saved it (§6); null for a browser session |
| `automation_run."botTurnId"` (nullable, FK `ON DELETE SET NULL`), beside `"sessionId"`, `CHECK (num_nonnulls("sessionId", "botTurnId") <= 1)` | The runs list links either; no execution field is copied (note 16 §Q4) |

## 4. The bot target (bots-chat)

`BotRoutineTarget`, contributed by bots-chat:

- **`decide`**: the bot is still there and its provider usable (a key, or
  a signed-in ChatGPT). A missing provider skips and pauses the routine
  (`bot_provider_missing`), so it does not fail every hour. Then it
  renders the opening message (below).
- **`launch`**: queues a turn through the same `enqueueWithin` a message
  uses, with `origin = 'routine'` and `sourceKey = automation-run:<runId>`,
  on the bot's provider, model and effort as they are now, as the owner,
  with the routine's credential scopes. A duplicate `sourceKey` returns
  the turn already queued. It answers `{ kind: 'bot_turn', turnId }`: the
  turn exists from this moment, queued or running, so the run always has
  its execution to point at.
- **Busy, overlap and repeats**: a routine whose last run's turn is still
  queued or running is *live*, so note 16's overlap guard (`skip` by
  default) is what stops a bot that was busy for an hour from running the
  same routine four times. No coalescing of its own.
- **Order**: turns run in the order they were queued, messages and
  routines alike, as today.

### The opening message

`BotMessageEvent` grows from `{ kind: 'approval' }` into a union with
the one routine-activity shape of "In the chat" below; a run's opening is
its `ran` activity, which the chat draws as one event line ("Routine ·
Morning PR digest"). Its words for the
bot are the routine's prompt, then, for an event trigger, the event inside
`<untrusted_external_data>` with note 16 §Q15's preamble: one pure
function in bots-chat's domain, `routineOpening`, beside `decisionTurn`.

`bot_turn."origin"` (`message` \| `approval` \| `routine`, default
`message`) says why a turn exists, so the chat and the runs list can tell
them apart without reading messages.

### The bot's routine tool

As in Grok Bot, a bot has **one** routine tool, `update_routine`, over
**its own** routines only (`automation."botId"` is the bot), and chat is
where routines are made and changed:

| Action | Input |
|---|---|
| `create` | `name`, `prompt`, `triggers` (one, or several that any one fires), `enabled` |
| `update` | `routineId` and what changes |
| `pause`, `resume`, `run_now`, `delete` | `routineId` |
| `list` | — (name, *when*, enabled, last and next run) |

Which calls ask is **one rule**, not a table: a pure policy beside the
tool, `routineCallAsks(action)`, answers *does the owner have to consent
to this?* A call runs without a card only when it **spends nothing and
can be undone**: `list` and `pause`. Everything else asks, `run_now`
included, because a bot's run is spend nobody clicked for (an unattended
routine turn could otherwise start another routine). Saving shows "Allow
{bot} to save a routine?" with the name, the *when* and the prompt. A new
action (rotating a webhook key, turning a template on) answers the same
question and needs no new row. The owner acting on the Routines tab
(§7) is the consent itself, so the tab never asks.

Every write answers the bot's whole list again, so it never acts on a
stale picture. It replaces 25 §4.5's `create_automation` family for a
bot's own routines; a bot still reads the workspace's other automations
with `list_automations`.

### In the chat

Routine activity in the chat is **one shape**: an event of kind
`routine` with `activity` (`saved` \| `changed` \| `paused` \|
`resumed` \| `deleted` \| `ran` \| `failed`), the routine's id and
name, the run when there is one, and a `reason` in words for `paused` and
`failed`. The chat draws them all as event lines; what differs is
rendering, not kind:

- `saved` to `deleted` read "Created routine *Morning PR digest*", a
  divider with the activity's mark. They belong to no turn (below), so
  each is its own line; folding several into "Routines in this change",
  as Grok Bot draws a turn's changes, waits until a line knows its turn.
- `ran` opens the routine's turn: "Routine · *Morning PR digest*" (§4,
  the opening message).
- `failed` is drawn as a notice, "Routine *Morning PR digest* did not
  run" with the reason, and **Open routines**: a run that expired, or one
  skipped by a run limit, a missed slot or an agent that cannot start. A
  skip the owner asked for (paused, deleted, still busy, our own event)
  is not a failure. A run that could not start because the bot's
  provider has no credential is told by its `paused` line instead
  (`bot_provider_missing`), which is drawn as the same notice with its
  reason; a pause the owner made is a plain line. A turn of a routine
  that ended `failed` says so in its own turn, as any turn does.
- **Lines outside a turn.** A routine changed on the tab, paused by the
  dispatcher or failed before its turn existed happened in no turn, so
  `bot_message."turnId"` is null for it, and only for an event. The chat
  places it by when it happened; the bot reads it in its history like
  any event. Each line's id is the domain event's, so an outbox
  redelivery writes it once.

**One writer.** The tool and the tab both change a routine through the
same automations commands (`SaveBotRoutine`, `RunAutomation`,
`DeleteAutomation`), and neither writes a line: the automation raises a
domain event for each change and its runs raise theirs, and one listener
in bots-chat turns an event of a bot's automation into its activity
line. A new way to change a routine writes its line without knowing the
chat exists.

## 5. When a session ends

"When a session linked to a task ends" is a trigger of automations, as
the export draws it: source `session`, event `session_ended`, with a
filter on what the catalog allows (`linkedToTask`, `startedBy`). An event
handler in automations on `SessionTurnChangedDomainEvent` (to an ended
state) matches it like any other event and fires a run, with the cause
key `session-turn:<sessionId>:<seq>`. A bot that wants to hear about the
sessions it starts holds a routine with `startedBy = itself`; there is no
watch table and no second consumer of the event.

**Changed 2026-10-22** (issue #445, note 27): a bot that wants to hear
back from a session it delegated holds a **subscription** to it, not a
routine: one delegation, ended with the work, waking on input needed too.
The trigger above stays for automations; its wake is still a queued turn.

## 6. The heartbeat, and trust

**A heartbeat is a routine** on a schedule whose prompt is "check in":
read your instructions, the plan, your open sessions, and act or stay
quiet. The bot creates one with `update_routine` (it asks, §4) when asked in
chat. `INSTRUCTIONS.md` already holds the bot's
job, so there is no separate heartbeat file.

- **Quiet turns.** A routine turn with nothing to say calls
  `nothing_to_report` instead of writing a message; the chat draws one
  collapsed activity line. OpenClaw does this with a `HEARTBEAT_OK`
  reply; a tool is explicit and cannot be confused with prose. Bots only:
  a person's session automation has a run page, not a chat.
- **Spread, not on the minute.** A schedule trigger's config gains an
  optional `spread` (minutes). The fire time is
  `slot + hash(triggerId, slot) mod spread`: deterministic, so every
  replica and every recomputation of `nextFireAt` agrees, and a
  workspace's routines do not all fire at 09:00:00. The console says
  "Every day around 09:00". A pure function in `trigger-config.policy.ts`,
  with a table test across DST changes.
- **The spend guard**, as Grok Bot does it. Routines that keep running
  while nobody reads what they say are money for nothing. *Unread* is the
  bot's routine turns that ended with something to say (quiet turns do
  not count) since the owner last opened the bot's chat
  (`bot."ownerReadAt"`). One pure policy, `routineSpendGuard`, answers
  `allow`, `nudge` or `pause`:

  | When | What happens |
  |---|---|
  | 3 unread and the chat unopened for 24 h | **Nudge**, once: a Needs input card, "You've been away for a bit. Keep my routines running?", with *Keep them running*, *Pause them all*, *Keep running, don't ask again*. The run goes ahead |
  | 10 unread, or the chat unopened for 72 h with any unread | **Pause**: every routine of the bot pauses with `pausedReason = 'unattended'`, the notice "Routines paused while you were away", and a card with *Resume routines* and *Keep them paused* |

  *Don't ask again* turns the guard off for that bot
  (`bot."routineSpendGuard" = false`). The numbers are `AutomationPolicy`
  settings at note 16's three levels. Grok Bot's own thresholds are not
  in its client, so these are ours. The shared run budget and the overlap
  guard still hold too.

  `BotRoutineTarget.decide` asks the policy and decides **this run
  only**: `pause` skips it with reason `unattended`. Pausing the bot's
  whole set is a bot-level step of its own, `PauseUnattendedRoutines`
  (bots-chat), raised by a listener on that skip and idempotent, so two
  runs skipping at once pause the set once and no routine's run owns the
  others.
- A routine **runs as its owner** (note 16 §Q5), re-checked at dispatch,
  with the bot's permissions as they are at the run; a routine never
  widens them. A routine created **by the bot** goes through
  `update_routine`, which asks, and Approve is the consent. A routine
  from a template starts paused, and the bot asks once whether to turn
  them on.
- A routine fired by people outside the workspace (an issue opened by
  anyone) keeps the bot's *ask* tools asking: an unattended turn cannot
  approve its own card.

## 7. The Routines tab

Bot settings gain **Routines**. As in Grok Bot, the chat is the editor and
the tab is controls: it changes whether and when a routine runs, never
what it is.

- **A row** is the name, the *when* in words ("Weekdays around 09:00",
  "When a PR opens in atlas") or "Paused", and a switch ("Pause *name*,
  *when*"). Its menu: Pause or Resume, **Run now** ("Running…" while its
  run is live), **Edit**, **Delete**.
- **Edit** puts "Edit your routine: *name*" in the chat's composer, so the
  bot changes it through `update_routine` and its card.
- **Delete** confirms: "This deletes the routine and stops its future
  runs. This can't be undone."
- **Opening a row** shows its instruction (the prompt, as Markdown), *when
  to run* (one line per trigger, with its mark), and its last runs.
- **Empty**: "Routines are tasks this bot runs on a schedule or when
  something happens. Ask it in chat to set one up."

The switch, Run now and Delete are the owner acting, so there is no
card. They dispatch the same commands `update_routine` does, so their
activity lines come from the same listener (§4, "In the chat").
`/automations` lists bot routines too, with the bot that runs them.

## 8. Slices

Each is a stacked pull request, green on `pnpm ci:local`.

- **A. The run-target port** — built. `AutomationRunTargetPort`, the
  registry, `SessionRunTarget` holding today's dispatch, the run recording
  a `RunDispatchRef`; no behaviour change.
- **B. Bot routines in the API** — built. The automation columns of §3,
  `bot_turn."origin"` and `"sourceKey"`, `BotRoutineTarget`, the routine
  opening message (its `ran` activity and "Routine · *name*" line), and
  `update_routine` with its consent policy. The console's session lists
  leave routines out until C draws them.
- **C. The Routines tab** of §7, in two pull requests. The first is the
  tab: `GET`, `PATCH`, `POST …/run` and `DELETE` under
  `/bots/:id/routines`, dispatching the commands `update_routine` does, and
  a `RoutineCard` per routine (switch, Run now, Edit in chat, Delete). The
  second: bot routines on `/automations`, the activity listener with the
  other activities and the failure notice, and the `bot_provider_missing`
  pause (until then a routine whose bot has no usable provider is skipped,
  not paused).
- **D. Heartbeat comfort.** `nothing_to_report`, `spread`, and the spend
  guard with its two cards.
- **E. More triggers.** "When a session ends" (§5), then a webhook with a
  key per routine (`POST /automations/webhook/{id}`, `Authorization:
  Bearer`), as Grok Bot offers.

## Decided

- 2026-10-16, in review of the first draft: **a routine's run is a queued
  turn**, not a row in a wake ledger drained when a turn ends: the turn
  queue is already durable and handles a busy bot. Repeats are the
  overlap guard's; there is no coalescing and no priority for messages.
- 2026-10-16: **"when a session ends" is a trigger source of
  automations**, not a `bot_watch` table with its own event handler.
- 2026-10-16: **the open questions, decided.** A routine keeps the scopes
  of the credential that saved it; bot routines share the workspace's run
  budget; they are listed on the bot's Routines tab and on `/automations`;
  the quiet-turn tool is `nothing_to_report`, for bots only.
- 2026-10-16: **a bot routine has no project**: `projectId` is required
  only of session automations.
- 2026-10-18: **routines mimic Grok Bot's behaviour** (research §7 and
  its second read): one `update_routine` tool for a bot's own routines,
  where one consent policy decides which calls ask; a Routines tab of
  controls where Edit hands the change to chat; one routine-activity
  event for changes, runs and failures, written by one listener whatever
  path made the change; webhook triggers later. It replaces 25 §4.5's
  `create_automation` family for a bot's own routines.
- 2026-10-18: **the spend guard is back**, as Grok Bot has it: a nudge,
  then a pause of every routine of the bot, measured on unread routine
  results and the time since the owner opened the chat, with *don't ask
  again*. It replaces 2026-10-16's "no spend guard yet" (recorded in
  `product/README.md`), and stays a pure policy as that review asked; the
  pause of the whole set is a bot-level step, not part of one run's
  decision.
- 2026-10-18, building slice C's second half: **routine activity is a
  line outside any turn**, keyed by its domain event (`bot_message."turnId"`
  nullable for events only). The `failed` notice covers runs that expired
  or were skipped by a limit, a missed slot or an unavailable agent; a
  missing provider pauses (`bot_provider_missing`) and its `paused` line is
  the notice; a failed routine turn is shown by the turn itself. The
  "Routines in this change" group waits until a line knows its turn.
  `/automations` lists bot routines in their own table under the
  automations, each opening its bot's Routines tab
  (`GET /automations/routines`).
- 2026-10-16, in review of slice A: **the run records a `RunDispatchRef`**,
  a union over targets, and the dispatcher hands the handler a launch
  bound to its target, so a new target does not touch the handler.
