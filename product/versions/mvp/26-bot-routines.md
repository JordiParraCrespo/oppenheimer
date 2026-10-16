# 26 — Bot routines: how a bot wakes on its own

**Decided 2026-10-16, in review; built in the slices of §7. Built so
far: slice A**, the run-target port with the session target behind it. Note 25
builds a bot that only works when you write to it. This note is how it
works when you do not: on a schedule (its heartbeat), on an event, or
when a session ends. The 2026-10-13 export already draws it:
`BotSettings.dc.html` has a **Routines** tab whose rows are a name, a
*when*, a prompt and an on/off switch, with three kinds of *when*:
a schedule ("Weekdays at 09:00"), a GitHub event ("When a PR is opened in
atlas") and a session ("When a session linked to a task ends").

The research is `../../research/lessons-from-grok-bot.md` §6 (Grok Bot
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
`{ kind: 'routine', automationId, runId, name, cause }`, which the chat
draws as one event line ("Routine · Morning PR digest"). Its words for the
bot are the routine's prompt, then, for an event trigger, the event inside
`<untrusted_external_data>` with note 16 §Q15's preamble: one pure
function in bots-chat's domain, `routineOpening`, beside `decisionTurn`.

`bot_turn."origin"` (`message` \| `approval` \| `routine`, default
`message`) says why a turn exists, so the chat and the runs list can tell
them apart without reading messages.

## 5. When a session ends

"When a session linked to a task ends" is a trigger of automations, as
the export draws it: source `session`, event `session_ended`, with a
filter on what the catalog allows (`linkedToTask`, `startedBy`). An event
handler in automations on `SessionTurnChangedDomainEvent` (to an ended
state) matches it like any other event and fires a run, with the cause
key `session-turn:<sessionId>:<seq>`. A bot that wants to hear about the
sessions it starts holds a routine with `startedBy = itself`; there is no
watch table and no second consumer of the event.

## 6. The heartbeat, and trust

**A heartbeat is a routine** on a schedule whose prompt is "check in":
read your instructions, the plan, your open sessions, and act or stay
quiet. The bot creates one with `create_automation` (it asks, 25 §4.5)
and the Routines tab offers it. `INSTRUCTIONS.md` already holds the bot's
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
- **Cost** is held by what automations already has: the shared run
  budget (per automation and per workspace per hour), the overlap guard,
  and pausing from the Routines tab. There is no unread counter; if
  routines nobody reads turn out to cost too much, the fix is a pure guard
  on the automation, not a bot-level counter.
- A routine **runs as its owner** (note 16 §Q5), re-checked at dispatch,
  with the bot's permissions as they are at the run; a routine never
  widens them. A routine created **by the bot** goes through
  `create_automation`, which asks, and Approve is the consent. A routine
  from a template starts paused, and the bot asks once whether to turn
  them on.
- A routine fired by people outside the workspace (an issue opened by
  anyone) keeps the bot's *ask* tools asking: an unattended turn cannot
  approve its own card.

## 7. Slices

Each is a stacked pull request, green on `pnpm ci:local`.

- **A. The run-target port** — built. `AutomationRunTargetPort`, the
  registry, `SessionRunTarget` holding today's dispatch, the run recording
  a `RunDispatchRef`; no behaviour change.
- **B. Bot routines in the API.** The automation columns of §3,
  `bot_turn."origin"` and `"sourceKey"`, `BotRoutineTarget`, the routine
  opening message, the bot's automation tools scoped to its own routines.
- **C. The Routines tab.** Schedule and GitHub kinds, in bot settings;
  `/automations` lists bot routines too, with who runs them.
- **D. Heartbeat comfort.** `nothing_to_report` and `spread`.
- **E. When a session ends.** The `session` trigger source of §5.

## Decided

- 2026-10-16, in review of the first draft: **a routine's run is a queued
  turn**, not a row in a wake ledger drained when a turn ends: the turn
  queue is already durable and handles a busy bot. Repeats are the
  overlap guard's; there is no coalescing and no priority for messages.
- 2026-10-16: **"when a session ends" is a trigger source of
  automations**, not a `bot_watch` table with its own event handler.
- 2026-10-16: **no spend guard yet.** The shared run budget, the overlap
  guard and pausing hold the cost; a guard, if one is needed, is a pure
  policy on the automation.
- 2026-10-16: **the open questions, decided.** A routine keeps the scopes
  of the credential that saved it; bot routines share the workspace's run
  budget; they are listed on the bot's Routines tab and on `/automations`;
  the quiet-turn tool is `nothing_to_report`, for bots only.
- 2026-10-16: **a bot routine has no project**: `projectId` is required
  only of session automations.
- 2026-10-16, in review of slice A: **the run records a `RunDispatchRef`**,
  a union over targets, and the dispatcher hands the handler a launch
  bound to its target, so a new target does not touch the handler.
