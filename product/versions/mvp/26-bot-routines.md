# 26 — Bot routines: how a bot wakes on its own

**Proposed, 2026-10-16; the owner's questions are under "Open".** Note 25
builds a bot that only works when you write to it. This note is how it
works when you do not: on a schedule (its heartbeat), on an event, or
when work it started finishes. The 2026-10-13 export already draws it:
`BotSettings.dc.html` has a **Routines** tab whose rows are a name, a
*when*, a prompt and an on/off switch, with three kinds of *when*:
a schedule ("Weekdays at 09:00"), a GitHub event ("When a PR is opened in
atlas") and a session ("When a session linked to a task ends").

The research is `../../research/lessons-from-grok-bot.md` §6 (Grok Bot
0.71.2's routines, read from the shipped client on 2026-10-16) and
OpenClaw's heartbeat (`lessons-from-synara-and-openclaw.md`). Ideas are
taken, no code.

## 1. The shape in one paragraph

A bot never wakes itself. Something outside its loop decides it is time
and sends it a **wake**; every wake becomes a **turn**, opened by an
`event` message, exactly as an approval decision opens one today
(`bot-approval.policy.ts`, `decisionTurn`). There are two ports and a few
adapters on each:

```
                 driving side (who wakes it)                    driven side (how a run is carried out)
                 ───────────────────────────                    ──────────────────────────────────────
 schedule tick ─┐                                              ┌─ SessionRunTarget  (today's dispatch, moved)
 GitHub event  ─┼─► automations: match → firing → guards ──────┤   AutomationRunTarget port
 Run now       ─┘                                              └─ BotRoutineTarget  (contributed by bots-chat)
                                                                          │
 session turn ended ─► SessionCompletionWakeSource ─┐                     ▼
 another bot's reply ─► BotReplyWakeSource ─────────┼──────────► WakeBotCommand ─► bot_wake ledger ─► bot turn
 approval decided ───► ApprovalWakeSource ──────────┘            (one inbound port)   (pending, coalesced, drained)
```

- **Routines are automations whose run target is a bot.** We do not
  build a second scheduler. Note 16 already has the schedule tick, IANA
  zones, DST rules, missed-slot grace, the inbound-events hub, the guard
  chain, revisions, rate limits and the runs list; a routine reuses all
  of it and differs only in what a run *is*.
- **`AutomationRunTarget`** is the seam in automations: the port that
  turns a launched run into work. The session target is today's
  `CreateSessionCommand` dispatch, moved behind the port with no change
  in behaviour; the bot target opens a bot turn.
- **`WakeBotCommand`** is the one way into a bot that is not a person's
  message. Routines, finished sessions, other bots' replies and approval
  decisions all go through it, so idempotency, the busy-bot queue, the
  untrusted-data wrapper and the chat's event line are written once.

## 2. Patterns, and why each

| Pattern | Where | Why |
|---|---|---|
| **Port and adapters** (hexagon) | `AutomationRunTarget` with `SessionRunTarget` and `BotRoutineTarget` | Automations never imports bots-chat. A third target later (a Slack reply, a webhook call) is an adapter, not a branch in the dispatcher |
| **Registry by contribution** | `AutomationsModule.contributeRunTargets([...])`, the same shape as `InboundEventsModule.contributeSources` and `ProjectsModule.contributeUsage` | The module that owns a target registers it; the dispatcher looks targets up by `kind` and fails at boot on a duplicate or a missing one |
| **Strategy** per wake reason | `BotWakeRenderer` keyed by `reason` | Each reason owns its words for the bot, its chat line and its coalescing rule; the command handler stays the same size as reasons are added |
| **Command with an idempotency key** | `WakeBotCommand { botId, reason, sourceKey, … }` | Every hop that can run twice (a BullMQ retry, an event delivered twice) lands on the unique `(botId, sourceKey)`, the rule note 16 §3 writes down for every hop |
| **Durable ledger, then drain** | `bot_wake` rows; the turn worker drains on turn end | A wake that arrives while the bot is busy, or while the API restarts, is a row, not a job that can be lost. Grok Bot keeps the same thing ("from the durable pending-wake ledger") |
| **Guards as pure policies** | `routineGuards` in bots-chat's domain, run by `BotRoutineTarget.decide` | Same contract as note 16's guards (`allow`, `skip(reason)`, `defer(until)`); each is a function with a table test |
| **Domain events, not reads across modules** | bots-chat subscribes to `SessionTurnChangedDomainEvent` | Sessions already raises it for "a consumer that owns a turn's reason"; nothing subscribes yet, and this is the first |

## 3. The run-target port (automations)

```ts
// automations/application/automation-run-target.port.ts
export interface AutomationRunTarget<K extends RunTargetKind = RunTargetKind> {
  readonly kind: K;
  /** Target-specific guards, after the shared ones (paused, stale, owner). */
  decide(run: RunView, automation: AutomationView<K>, now: Date): Promise<TargetDecision>;
  /** Carry the run out as the owner; idempotent on `automation-run:<runId>`. */
  launch(run: RunView, automation: AutomationView<K>, scope: AccessScope): Promise<RunDispatchRef>;
}

export type TargetDecision =
  | { kind: 'launch' }
  | { kind: 'skip'; reason: AutomationSkipReason; pause: AutomationPausedReason | null }
  | { kind: 'defer'; until: Date };

export type RunDispatchRef = { kind: 'session'; sessionId: string } | { kind: 'bot_turn'; turnId: string };
```

- `RunDispatchResolver` keeps the shared guards (deleted, paused, stale,
  owner's scope) and then asks the target. The host capacity and disk
  guards move into `SessionRunTarget`, since only a session holds a place
  on a host.
- `DispatchAutomationRunCommandHandler` loses its `CreateSessionCommand`
  import; it calls `target.launch` and records the ref. Refusals keep
  going through `runRefusalOf`, and each target maps its own error codes.
- **Slice A is this refactor alone**, with the session target as the only
  adapter and the existing dispatch specs as its proof: no behaviour
  changes, so it ships on its own.

### What an automation records

| Change | Why |
|---|---|
| `automation.target_kind` (`session` \| `bot`, not null, default `session`) | The dispatcher picks the adapter from it; it never changes over an automation's life, so it is on the automation, not the revision |
| `automation.bot_id` (nullable, FK to `bot`, `ON DELETE CASCADE`), `CHECK ((target_kind = 'bot') = (bot_id IS NOT NULL))` | "The routines of this bot" is the Routines tab's one read; index `(bot_id) WHERE deleted_at IS NULL`. A bot's routines go with it, as Grok Bot's do |
| `automation_revision` session fields (host, agent, model, permission, repositories) nullable, with a `CHECK` per target kind | A bot routine's revision is its prompt; it runs on the bot's provider, model and effort **as they are at the run**, like an approval's turn |
| `automation_run.bot_turn_id` (nullable, FK `ON DELETE SET NULL`), beside `session_id`, with at most one set | The runs list links either; no execution field is copied (note 16 §Q4) |

## 4. The wake port (bots-chat)

```ts
// bots-chat/commands/wake-bot/wake-bot.command.ts
export class WakeBotCommand extends Command {
  readonly botId: string;
  readonly reason: BotWakeReason;     // 'routine' | 'session_ended' | 'bot_reply' | 'approval'
  readonly sourceKey: string;         // 'automation-run:<id>', 'session-turn:<id>:<seq>', …
  readonly actingUserId: string;      // whose scope the turn runs in (the owner, note 16 §Q5)
  readonly payload: BotWakePayload;   // per reason; any outside text is marked untrusted
}
```

The handler, in one transaction:

1. Inserts `bot_wake` on `(bot_id, source_key)`; a duplicate is a no-op
   that returns the existing row.
2. If the bot has no queued or running turn, opens one: `BotTurnEntity`
   with `origin` set to the reason, and an `event` message rendered by
   the reason's `BotWakeRenderer`. The wake becomes `opened` with the
   turn's id.
3. Otherwise the wake stays `pending`. When a turn ends, the
   `bot-turns` worker drains: the oldest pending wake opens the next
   turn, and pending wakes that share its `coalesce_key` (the same
   routine twice) fold into it as `coalesced`, so a bot that was busy for
   an hour does not run the same routine four times in a row.

A person's message always goes first: a message you send while wakes
are pending is queued ahead of them, and Stop on a routine turn does not
drop the pending wakes behind it.

### The renderer per reason

```ts
export interface BotWakeRenderer<R extends BotWakeReason> {
  readonly reason: R;
  /** What the bot reads; outside text goes inside <untrusted_external_data>. */
  forBot(payload: BotWakePayloadOf<R>): string;
  /** What the chat draws: the event line, no words read back. */
  forChat(payload: BotWakePayloadOf<R>): BotMessageEvent;
  coalesceKey(payload: BotWakePayloadOf<R>): string | null;
}
```

`BotMessageEvent` grows from `{ kind: 'approval' }` into a union with
`routine` (name, automation id, run id, cause), `session_ended` (session,
turn, how it ended) and `bot_reply` (which bot). Today's approval
decision moves onto the command in slice B, which proves the port on a
path that already has tests.

### The ledger

| Column | |
|---|---|
| `id` uuid, `organization_id`, `bot_id` (FK `ON DELETE CASCADE`) | |
| `reason` text, `CHECK` against the catalog | |
| `source_key` text, `UNIQUE (bot_id, source_key)` | idempotency |
| `coalesce_key` text null | folding repeats |
| `payload` jsonb | validated by the reason's Zod schema on write |
| `status` `pending` \| `opened` \| `coalesced` \| `expired` | |
| `turn_id` null, FK `ON DELETE SET NULL` | |
| `acting_user_id`, `created_at`, `settled_at` | |

Index `(bot_id, created_at) WHERE status = 'pending'` for the drain.
A pending wake older than the stale TTL (1 h, note 16's setting) expires
instead of opening a turn about something long past, and at most 20 wait
per bot: the oldest beyond that expire, each with a line in the chat.

## 5. The adapters

### BotRoutineTarget (automations → bot)

`decide` runs the bot-specific guards; `launch` sends `WakeBotCommand`
with `sourceKey = automation-run:<runId>` and returns the turn's id (or
the pending wake's, filled in when the turn opens).

| Guard | Rule |
|---|---|
| Bot alive | a deleted bot skips (`bot_deleted`); the cascade normally got there first |
| Provider usable | the bot's provider has a key or a signed-in ChatGPT; otherwise skip and pause (`bot_provider_missing`) so it does not fail hourly |
| Attention (spend guard, §6) | the owner is still reading what routines produce |
| Chain | a routine turn starts a chain at depth 0 under `BotChainPolicy`, so routines that ask other bots stay bounded |

### SessionCompletionWakeSource (sessions → bot)

When a bot starts a session (`start_session`), the tool also records a
**watch**: `bot_watch (bot_id, session_id, turn_seq, created_at,
expires_at, wakes)`. An event handler in bots-chat on
`SessionTurnChangedDomainEvent` with `to` in the ended states finds the
watches for that session and sends `WakeBotCommand` with `reason =
'session_ended'`, `sourceKey = session-turn:<sessionId>:<seq>`. The bot
learns its work is done without polling `get_session`. A watch expires
after 24 h, and `start_session` takes `notify: false` for fire-and-forget
work. The export's third kind, "When a session linked to a task ends", is
a routine whose trigger is this event; it is the same source fed into
automations as a trigger instead of a watch.

### BotReplyWakeSource and ApprovalWakeSource

`ask_bot` (not built) delivers the other bot's answer as a `bot_reply`
wake instead of holding the asking turn open; the approval decision
already works this way and moves onto the command.

## 6. The heartbeat, and the spend guard

**A heartbeat is a routine** on a schedule whose prompt is "check in":
read your instructions, the plan, your open sessions, and act or stay
quiet. The bot can create one with `create_automation` (asks, §4.5 of 25)
and the Routines tab offers it. There is no separate heartbeat file:
`INSTRUCTIONS.md` already holds the bot's job, and a routine's prompt
says what to do at that moment.

- **Quiet turns.** A routine turn with nothing to say calls
  `nothing_to_report` instead of writing a message. The chat draws one
  collapsed activity line, it does not count as unread, and its tokens
  still count. OpenClaw does this with a `HEARTBEAT_OK` reply; a tool is
  explicit and cannot be confused with prose.
- **Spread, not on the minute.** A schedule trigger's config gains an
  optional `window` (`from`, `to`, local time) and `spread` (minutes).
  The fire time is `slot + hash(triggerId, slot) mod spread`: deterministic,
  so every replica and every recomputation of `nextFireAt` agrees, and a
  workspace's routines do not all fire at 09:00:00. The console says
  "Every day around 09:00", as Grok Bot does. It is a pure function in
  `trigger-config.policy.ts`, with a table test across DST changes.
- **The spend guard.** A routine that keeps producing results nobody
  reads costs money for nothing. `bot.owner_read_at` (set when the owner
  opens the chat) against the routine turns since:

  | Unread routine results since the owner last read | What happens |
  |---|---|
  | 5 | A **Needs input** card: *Keep them running*, *Pause them all*, *Keep running, don't ask again* |
  | 10 | The bot's routines pause with `pausedReason = 'unattended'`, an event line says so, and a card offers *Resume routines* |

  Quiet turns do not count. Both numbers are `AutomationPolicy`
  settings, at the three levels note 16 defines; "don't ask again" sets
  the bot's own level to off.

## 7. Permissions and trust

- A routine **runs as its owner** (note 16 §Q5), in the owner's scope at
  the run, re-checked at dispatch. Its tools are the bot's permissions as
  they are at the run; a routine never widens them.
- A routine created **by the bot** goes through `create_automation`,
  which asks: the approval card shows the name, the *when* and the
  prompt, and Approve is the consent. A routine created from a template
  starts paused, and the bot asks once whether to turn them all on, as
  Grok Bot does.
- **Event text is data.** A GitHub or session payload reaches the bot
  inside `<untrusted_external_data>` with note 16 §Q15's preamble, built
  by the renderer, never by a template that splices text into the
  prompt.
- A routine fired by people outside the workspace (an issue opened by
  anyone) keeps the bot's *ask* tools asking: an unattended turn cannot
  approve its own card.

## 8. Slices

Each is a stacked pull request, green on `pnpm ci:local`.

- **A. The run-target port.** `AutomationRunTarget`, the registry,
  `SessionRunTarget` holding today's dispatch; no behaviour change.
- **B. The wake port.** `WakeBotCommand`, `bot_wake`, `bot_turn.origin`,
  the drain in the `bot-turns` worker, the renderer registry; the
  approval decision moves onto it.
- **C. Routines.** `automation.target_kind` and `bot_id`,
  `BotRoutineTarget`, the routine `BotMessageEvent`, the Routines tab
  (schedule and GitHub kinds), the bot's automation tools scoped to its
  own routines.
- **D. Heartbeat comfort.** `nothing_to_report`, `window` and `spread`,
  the spend guard and its two cards.
- **E. Watches.** `bot_watch`, the `SessionTurnChangedDomainEvent`
  handler, the session kind of routine.

## Open

1. **Credential scopes of a routine turn.** A message's turn carries the
   scopes of the credential it was sent with. A routine created through an
   API token: does the routine keep that token's scopes, or the owner's
   full scope? Proposed: keep them, stored on the automation, so a token
   reaches no further through a routine than through a message.
2. **Do bot routines share the workspace's run budget** (100 runs an hour)
   with session automations, or have their own? Proposed: shared; a turn
   is cheaper than a session but the guard is about runaway loops.
3. **Where routines are listed.** The bot's Routines tab only, or also
   `/automations` with a "runs as" column? Proposed: both; it is one table.
4. **The quiet-turn tool's name**, and whether a person's own routine
   turns (not a bot's) want the same.
