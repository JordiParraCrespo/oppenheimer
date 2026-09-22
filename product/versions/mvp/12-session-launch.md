# 12 — Session launch: the options, the first prompt, and the name

[`05-screens.md`](05-screens.md) draws a New session screen whose
composer foot row carries a **permission level**, an **agent and a
model**, an **effort** and a **first task**. `POST /sessions` accepts
none of them: it takes a host, an agent, checkouts and an optional name
([`10-api-modules-and-data-model.md`](10-api-modules-and-data-model.md)).
The console cannot be built against the screen until the API has the
fields the screen sets, so this note decides them — the schema, the wire,
the log, the columns and the naming — before a line of the screen is
written.

Scope: the control plane's surface and the two contracts it sits between
(the shared schemas and the runner protocol). The screen itself is
[`plans/new-session-screen.md`](../../../plans/new-session-screen.md).

## What the screen asks for, and where it lands today

| On the artboard | What it decides | Today |
|---|---|---|
| Host chip | which machine | `hostId` ✓ |
| Repository chip (multi) + branch pane | what is checked out, from which base | `checkouts[]` ✓ |
| Engine button, first pane | the agent | `agent` ✓ |
| Engine button, second pane | the **model** | on the wire only (`session.create.model`), not on the route |
| Permission menu | ask for approval / approve for me / **full access** | nothing |
| Effort popover | five stops, Minimal → Max | nothing |
| Composer | the **first task** | nothing |
| Mic | dictation | client-side; no API |

Five of the eight are the subject of this note.

## Decided

### 1. The four launch options are one object, named once

```ts
// packages/shared/src/schemas/session.schema.ts
export const SESSION_PERMISSIONS = ['ask', 'auto', 'full'] as const;
export const SESSION_EFFORTS = ['minimal', 'low', 'medium', 'high', 'max'] as const;

export const sessionLaunchSchema = z.object({
  model: z.string().min(1).max(128).optional(),
  permission: z.enum(SESSION_PERMISSIONS).default('ask'),
  effort: z.enum(SESSION_EFFORTS).optional(),
});
```

They travel together everywhere — the route body, the log payload, the
wire frame, the response — so they are one object with one name
(`launch`) rather than four fields spelled four times. `agent` stays
outside it: the agent is *what the session is*, the launch is *how it was
started*, and only the second is a thing a later slice changes without
making a different session.

### 2. Permission is a product vocabulary; the flags live in the catalog

Three levels, because the artboard draws three, and the third is drawn in
a warning tone because it changes somebody's machine unattended. The
**translation to CLI flags is a field on the catalog entry** in
`packages/shared/src/agents/catalog.ts`, beside `command`,
`configDirEnv` and `loginUrlPattern`:

```ts
readonly launch: {
  /** How a model id is passed, as argv with `<id>` substituted. */
  readonly model?: readonly string[];
  readonly permission: Readonly<Record<SessionPermission, readonly string[]>>;
  /** Only the stops this agent can actually express. */
  readonly effort?: Readonly<Partial<Record<SessionEffort, readonly string[]>>>;
}
```

A `permission` column would state the same decision once per agent. The
catalog already owns every other "how to launch it" fact and is already
the thing the runner reads, so this is where it belongs — and it stays
data, with no function in it, exactly as the catalog's own header
insists.

**The exact flag strings are the one thing in this note that a document
cannot decide.** They are read off each CLI's own `--help` at
implementation time, in one commit, with the version they were read from
recorded beside them. Writing them from memory is how a launch silently
becomes `full access` on a stranger's laptop.

> **Read off, 2026-09-21.** claude 2.1.278 takes `--permission-mode`
> (`manual` / `acceptEdits` / `bypassPermissions` for the three levels)
> and `--effort` with five levels of its own, so the slider's five stops
> map one to one and none of them collapse. codex-cli 0.155.1 has
> `--ask-for-approval`, `--sandbox`, and its own `--approve-for-me` —
> which is the middle level under the CLI's own name for it — plus
> `--dangerously-bypass-approvals-and-sandbox`. Its effort is the
> `model_reasoning_effort` config key rather than a flag, and its
> vocabulary stops at `high`, so the top two stops land on the same
> level. Those four value names are the one thing not read off a
> `--help`; the CLI accepts an unrecognised value without failing, so a
> wrong name costs the setting rather than the launch.

**`full` is never a remembered default.** Chips remember the last choice
(05); this one does not. A permission that escalates by being used once
is the failure `product/04-security-review.md` exists to prevent, so the
console seeds `ask` on every new session and the API's own default is
`ask`.

### 3. Effort is five stops, and an agent with fewer says which it has

The slider is a product control, not a CLI flag passed through: the
catalog declares which stops an agent can express, the console hides the
control for an agent that declares none, and the runner **drops** a stop
it cannot express rather than failing the launch. A thinking budget is
never worth refusing a session over.

### 4. Models stay out of the database and out of the API surface

The catalog grows `models: readonly { id, label, default? }[]`. No table,
no endpoint: the console already imports the catalog, so opening the
engine button's second pane costs no round trip, and a deployment that
adds an agent adds it in one place.

Claude Code's entry lists the aliases its own `--help` documents
(`opus`, `sonnet`, `fable`) rather than pinned ids, which are a moving
target this repository is in no position to keep current. **Codex ships
an empty list**, because inventing ids would be a second model list that
drifts from the CLI's own — and an agent with no models is a case the
engine button already has: it is picked outright and the button names
the agent. Open question 3 is what fills it. What a *host* can actually run may
narrow the list later through `host.capabilities` — a hint on the chip,
never a gate, which is the rule the agent itself already follows.

This keeps the first half of note 10's "Models: no table, no column" and
changes the second half; see (5).

### 5. The launch options are folded into columns

Note 10 decided a model was "recorded in the log, not a column", and
said promoting it later would be *a replay, not a backfill*. This note
does that promotion, for three reasons the model picker creates:

- **`restart` must relaunch a session the way it was launched.** Reading
  the log to find out costs a walk per restart.
- **The console shows the engine button on a session that already
  exists**, so the options are a per-row read.
- **New session seeds from the last choice**, which is a read of the most
  recent session's options.

The fold is not a second truth — every column on `work_session` is
already a projection of its log — so this is three more fields of
`SessionFold`, written by two events and rebuilt exactly by a replay:

- `session.requested` carries `{ …, launch }` in its payload (the writer
  at create);
- a new `SESSION_EVENT_KINDS.LAUNCH_OPTIONS_SET = 'session.launch_options_set'`
  is the writer for changing them on a live session, which is the slice
  after this one. The kind is added with its writer, never before — the
  vocabulary's own rule.

Columns: `launchModel varchar null`, `launchPermission varchar not null
default 'ask'`, `launchEffort varchar null`. They are union-typed columns,
so they follow `.agents/rules/typeorm.md`. `launch` is then a field on
`SessionResponseDto`.

### 6. The first prompt is a field on create, an entry in the log, and a field on the wire

```ts
prompt: promptSchema.optional()   // 2 KB of UTF-8, which is what 02 §7 says
```

on `createSessionSchema`.

> **Corrected in review.** A draft of this allowed 16,000 *characters*, which
> two existing limits already contradicted: `02-runner.md` §7 caps
> `prompt.first` at 2 KB, and every `work_session_event` payload is capped at
> 8 KiB of serialized JSON. Four bytes per character is legal UTF-8, so the
> route would have accepted a prompt the log then **rejected** — committing a
> session whose task nothing recorded, and which therefore never named itself
> and never reached its host. The bound is bytes now, at the number 02 already
> states. Three things happen to it, in this order:

1. **It is appended as `prompt.first`** with `source: 'api'`, in the same
   transaction as the session row — one user action, one entry, which is
   the rule the dispatch port is built around. That kind has two writers
   from here on, and its comment says so.

   > **Corrected while building this.** The draft said the two writers
   > would dedupe on a shared idempotency key. They cannot: the API keys
   > its entries by command id and the runner keys its by run, so a key
   > is exactly what they do not share. What must not happen twice is the
   > **naming**, and what stops it is the name itself — the resolver
   > skips a session that already carries one, from a person or a model,
   > because the *first* prompt is the one it names from and there is
   > only one of those. The log may hold the runner's own observation of
   > the same first message; that is a true record of what the host saw.
2. **It is carried on `session.create`** as `prompt`, and the runner
   types it into window 0 once the agent is ready. Deliberately not a
   separate `session.input` after `session.started`: input needs the agent
   up, and a second message is a race the launch already knows how to
   avoid.
3. **It names the session** (7).

It is stored nowhere but the log, and it is never returned on a list.
A prompt is the person's own sentence; the log and the host are the two
places it belongs.

One consequence is worth stating plainly: because delivery rides the
launch, **a session created while its host is offline keeps its prompt in
the log and delivers it when the launch is finally dispatched.** Nothing
in this design waits on the relay — which is what makes the console's
composer honest before the relay exists.

### 7. The name comes from the prompt, through a fast open-weights model

The machinery is already built: `SessionNamerPort`,
`SessionNamingResolver`, the no-op adapter, the `session_namer`
capability, and the fold's rule that a model-derived name never overwrites
one a person typed. Two changes:

**A second provider, `openai-compatible`.** One adapter,
`POST {baseUrl}/chat/completions`, which is the shape Groq, Together,
Fireworks, DeepInfra, OpenRouter, vLLM and a local Ollama all speak — so
"a fast open-source model" is a matter of configuration rather than a
third adapter per vendor. Open weights (Llama, Qwen, Mistral, Kimi) on a
fast host is exactly the workload a 32-token title wants.

```
SESSION_NAMER_PROVIDER=openai-compatible
SESSION_NAMER_BASE_URL=https://api.groq.com/openai/v1
SESSION_NAMER_MODEL=<a model id this deployment picked>
SESSION_NAMER_API_KEY=…          # optional: a local server may want none
```

Same posture as the Anthropic adapter, copied deliberately: a 5-second
timeout, a 32-token budget, the same strict system prompt, and every
failure swallowed into `null`, because the fallback is the session's own
slug and a title is not worth failing a request over.
`sessionNamerIsConfigured` grows a second arm and stays the one predicate
the capability, the factory and the adapter all call. `anthropic` stays
supported; `none` stays the default.

**A second caller.** `CreateSessionCommandHandler` calls the resolver with
the prompt entry it just appended — **after** the response is built and
**without awaiting it**. Naming must never put a model call on the
critical path of creating a session; the name lands in the log a moment
later and the console reads it on its next listing. The resolver already
takes the aggregate the caller holds and appends through the same locked
path, so a runner batch arriving meanwhile cannot be overwritten.

### 8. What does not change

No new endpoints, no new tables, no new scopes: `POST /sessions` grows
fields under `sessions:write`, and its `Idempotency-Key` now also covers
the prompt entry and the name. The rate limit stands — a session is still
directories, a checkout and a process on somebody's machine.

## The surface, in full

```ts
// POST /sessions
{
  hostId: uuid,
  agent: 'claude-code' | 'codex',
  projectId?: uuid,
  name?: string,                       // ≤ 200; sets nameSource 'user'
  checkouts: [{ installationId, githubRepoId, baseBranch? }],
  cwdGithubRepoId?: number,
  launch?: { model?: string, permission?: 'ask'|'auto'|'full', effort?: Effort },
  prompt?: string                      // ≤ 2 KB of UTF-8 (02 §7)
}
```

```ts
// control plane → runner, session.create (added fields)
  launch: { model?: string, permission: Permission, effort?: Effort },
  prompt?: string,
```

```ts
// SessionResponseDto (added)
  launch: { model: string | null, permission: Permission, effort: Effort | null }
```

Migration: three nullable/defaulted columns on `work_session`. No
backfill — existing rows are `ask` with no model, which is what they were
launched with.

## Open questions

1. **Effort for Claude Code.** Codex takes a reasoning effort as a
   setting; Claude Code's thinking budget is expressed differently. If the
   catalog declares no stops for it, the slider is Codex-only in version
   1 — is that acceptable, or should the console express effort for
   Claude Code some other way?
2. **A policy that forbids `full`.** A host is somebody's laptop. Should a
   workspace be able to refuse full access outright, and is that a host
   setting or a workspace one?
3. **Model discovery.** Orca probes the CLI and degrades to the catalog
   seed on a failed probe. Do we probe at pairing time and put the result
   on `host.capabilities`, or stay with the seed for version 1?
4. **Where the last choice is remembered.** Globally, or per project? Per
   project is more nearly right and needs a place to keep it.

## Order of work

1. `packages/shared`: `sessionLaunchSchema`, the two unions,
   `FIELD_BOUNDS.prompt`, the catalog's `launch` and `models`, and the
   protocol's `session.create` fields. Cross-version conformance spec
   follows.
2. `apps/api`: migration + ORM columns, the fold and its replay tests,
   the `session.requested` payload, the DTO, the create handler (prompt
   entry, dedupe key, naming call), the launch spec.
3. `apps/api`: the `openai-compatible` namer, its config arm and the
   capability.
4. Tests: fold replay, the `prompt.first` dedupe, the handler, the namer
   adapter.
5. `pnpm generate:api-client`.
6. Then the screen: [`plans/new-session-screen.md`](../../../plans/new-session-screen.md).
