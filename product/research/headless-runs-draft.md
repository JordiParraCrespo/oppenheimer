# Headless runs: automation through `claude -p` (a draft)

> **Proposal, not adopted.** Research brought over from pull request
> #43, which was closed on 2026-10-10 without merging. It was drafted as
> `versions/mvp/18-headless-runs.md` before automations moved into the
> MVP. What governs is
> [`versions/mvp/16-automations-architecture.md`](../versions/mvp/16-automations-architecture.md),
> which built on this draft; the note's own "Read with 16" says where.
> Bare numbers in it name `versions/mvp/` notes. Its numbered
> cross-references (`02 §14`, `03 §Cloud hosts` and the like) point at
> sections that pull request proposed and that the current notes do not
> have. Paths in backticks are relative to `product/`.

> **Read with 16.** This draft came before automations moved into the
> MVP. 16 (2026-09-27) builds on it, decides what ships, and governs
> where the two differ: automations are in the MVP and the model is
> `automation*` in `automations/`, not `routine*`; the runner ships raw
> lines tagged `{agent, format}` and a per-agent adapter in the API
> translates them, rather than the runner reading the stream; execution
> is `sessions/`'s `session_turn` with `turn.started` and `turn.ended`,
> not `run.*` events. The detail 16 leans on stays here: the launch (§2),
> permissions with nobody watching (§3), which repositories run (§4),
> turns and takeover (§5, §6).

The 2026-09-26 export (`design/version1/Routines.dc.html`, drawn inside
`SessionsConsole.dc.html`) gives the console a routines page, which the
evening export's copy calls **Automations**; the rename is in the copy
only, and this note keeps `routine` for the model as the frames and
`design/README.md` do. 13 records the console's side of automations
and leaves their data model open; this note is the host's side. A
routine is a saved prompt with a project, an agent, a model and a host, plus the
triggers that start it; each start is a **run** with a state, a cause
and a duration. This note decides how a run executes on a host, which is
the part the design cannot show, and names what the rest of the stack
gains for it. Research behind it: the Stripe Orbit screenshots, Cyrus
(`ceedaragents/cyrus`, Apache-2.0) and the Claude Code headless docs, read
on 2026-09-26.

## What the export shows

- **A routine**: name, project, agent, model, host, prompt, active or
  paused, and one or more **triggers**. "Any trigger starts a run."
- **Triggers** in the frames: a schedule (once, daily, weekdays, weekly,
  at a time) and GitHub events with a filter (`pr_opened` on a branch,
  `release`, `issue_labeled` with a label).
- **Run now**, which works while paused; **Pause**, which makes triggers
  ignored until resumed; **Delete**, which stops triggers and keeps past
  runs.
- **Run history** per routine: `completed` or `failed`, the cause
  ("Schedule", the GitHub event), when, how long.
- **Templates**: dependency audit, standup digest, flaky-test tracker.

## What it proposed

### 1. A run is a session driven by `claude -p`

A person's session is Claude Code's terminal UI in tmux, and stays so. An
automated run is **the same kind of session** — the same directory of
checkouts, the same worktree and branch, the same tmux session on the
same host (02 §5) — whose window 0 runs Claude Code **headless**:

```
claude -p <prompt> --output-format stream-json --verbose
       [--model …] [--effort …] --permission-mode <mode>
       --permission-prompts none [--resume <agentSessionId>]
```

It is the CLI the host already has, installed and logged in by its
owner, launched the way 02 §5 launches the TUI. Not the Agent SDK as a
library: the runner is Go and the SDK is Python or TypeScript around the
same binary, so it would add a runtime to every host for controls a first
version does not need (approval callbacks, answering questions mid-turn).
The SDK stays the upgrade path if those are wanted later (§Open).

Why headless rather than typing the prompt into the TUI: `stream-json`
is a structured record of every message, tool call, retry and the final
`result` (state, duration, cost estimate, `permission_denials`). Run
history, a run's activity feed and any reply to Linear or Slack come
straight from it, with no screen scraping and no hooks to install.

### 2. The launch

- **`session.create` gains `drive`**: `interactive` (the TUI, today's
  only value and the default) or `headless`. It rides the create like
  `runtime` does (01), because how the agent is started is what the
  runner is being asked to start.
- **The catalog grows a `headless` block per agent** in
  `packages/shared/src/agents/catalog.ts`: the argv that selects
  headless mode and structured output, and the permission levels that
  make sense with nobody watching. Claude Code's is the one above. An
  agent without the block cannot be the agent of a routine, and the
  console hides it in the routine form. Codex (`codex exec --json`) and
  the others are a row each when they are wanted; no protocol change.
- **The argv stays a vector** (02 §5). The prompt is one argument, never
  spliced into a string.
- **Output goes to a file, through the runner itself.** Window 0 runs
  `runner headless --out <session>/.oppenheimer/runs/<n>.jsonl -- claude
  -p …`: a small subcommand that execs the agent with stdout and stderr
  on files and exits with its code. tmux keeps the process alive across a
  runner restart or self-update, as it keeps every session (00, 09 §5),
  and the runner **tails the file by byte offset**, so a restart resumes
  the feed where it stopped instead of losing the turn. No shell, no
  redirection string.
- **Version gate.** `--permission-prompts` needs Claude Code 2.1.259 or
  later; the runner already probes each agent's version (02 §10), and the
  control plane refuses a headless create for an older one with a catalog
  code, as it refuses an agent the runner never probed.

### 3. Permissions with nobody watching

`ask` has no one to ask. A headless run takes `auto`
(`--permission-mode acceptEdits`) or `full` (`bypassPermissions`), and
always `--permission-prompts none`: anything that would have prompted is
denied, Claude is told not to retry, and the denial lands in the stream
and in the run's record, so a routine that keeps hitting one is visible
rather than stuck. The routine form offers those two levels; `ask` is
not offered.

`auto` is narrower headless than it feels in the terminal: with
`acceptEdits`, file writes and common filesystem commands go through,
but other shell commands — a test suite, a build — are denied unless an
allow rule covers them. A routine that must run tests either takes
`full` or relies on the repository's own `permissions.allow` rules.
Mapping `auto` to Claude Code's classifier mode (`--permission-mode
auto`) instead is a catalog change, left open below.

### 4. Which repositories may run headless

`claude -p` without `--bare` loads the working directory's hooks,
`.mcp.json` servers, `CLAUDE.md` and skills **with no trust prompt**. A
run therefore executes whatever its repository configures. Runs are
allowed only on repositories already in one of the person's projects
(10), which they connected and chose; that is the same trust they give
the interactive session they would otherwise start there. Runs are not
`--bare`: a routine that ignored the repository's `CLAUDE.md` would do
the work worse than a person's session in the same place. A trigger's
payload (an issue body, a PR title) is **data in the prompt**, framed as
such by the prompt template, never a flag or an argument of its own.

### 5. One agent session, several turns

- The runner reads Claude Code's session id from the stream's first
  `system/init` event and reports it on the run (`agentSessionId`).
- **A follow-up** — Run now on a routine that keeps its session, a
  comment on the issue that started it (§7) — is a new `claude -p
  --resume <agentSessionId> <prompt>` turn once the previous one has
  exited. Turns on one session are **serialised**: a follow-up that
  arrives mid-turn waits in the log and is dispatched when `result`
  lands. Feeding a message into a running turn needs streaming input
  (`--input-format stream-json` or the SDK) and is not in this slice.
- **Stop** sends SIGINT, which ends the turn and records it; SIGTERM is
  kept for a process that does not exit (it leaves the turn unfinished,
  exit 143).

### 6. A person can take over

Headless and interactive Claude Code share one transcript store on the
host (`~/.claude/projects/<dir>/<id>.jsonl`), and `--resume` finds a
session by id from any directory on the same machine. **Open in
terminal** on a run whose turn has ended opens window 0 as the TUI with
`claude --resume <agentSessionId>` in the same worktree: the conversation,
the branch and the files are all there. The two never write at once: the
button is disabled while a turn runs, and a follow-up waits while a
person holds the session.

### 7. Where triggers live

The control plane owns routines, triggers and scheduling; the runner only
executes. A schedule is a repeatable job on the API's queue
(`@oppenheimer/backend-queue`); a GitHub event arrives on the App's
webhook the API already receives. Each fire is recorded before anything
is dispatched, so a run a host was offline for is created and delivered
when it reconnects, as any create is (01). Linear and Slack are later
trigger types on the same routine (`{ type: 'linear', team, event,
filter }`, `{ type: 'slack', channel, event: 'mention' }`); they differ
only in that the run keeps a **reply binding** — the issue or thread —
so its progress and result are posted back there and replies there
become §5's follow-ups. The integrations sit in the control plane,
never on the host: tokens stay off the machine and no inbound path is
opened (Cyrus puts them on the host behind a Cloudflare tunnel; we do
not).

### 8. What a run records

From the stream, per run: cause (schedule, which event), `startedAt`,
`endedAt`, state (`running`, `completed`, `failed`, `stopped`), the
agent session id, the `result` text, `total_cost_usd` (a client-side
estimate, shown as one), turn count and permission denials. The raw
events are the session's log (`events.append`, 01), batched and
acknowledged by key like every other session event, so the activity
feed is a view of the log and not a second store.

## What the other notes gain

Recorded here, written into each note when its slice is built:

- **01**: `drive` on `session.create`; the run events (`run.started`,
  `run.event`, `run.ended`) as session events on `events.append`.
- **02**: the `headless` subcommand and the tailing reader beside the
  tmux adapter; the version gate; SIGINT on stop.
- **03 / 10**: `routine`, `routine_trigger` and `routine_run` in a
  `routines/` module that creates sessions through `sessions/`; schedules
  on the queue; the GitHub webhook routed to triggers.
- **05**: the routines page from the export, and a run's view (its
  activity feed and the Open in terminal button) instead of a terminal
  while it runs.
- **The catalog**: the `headless` block.

## Open

- **When.** Automations stay after the MVP (00, 13): only their console
  routes exist ahead of the API. Whether §7's GitHub triggers ship with
  schedules or after them is decided with that slice.
- **Whose login a run uses.** The run uses the host's Claude Code as its
  owner logged it in. Anthropic's Agent SDK terms say third parties may
  not "offer claude.ai login or rate limits for their products" without
  approval. We offer no login — the person logs into their own CLI on
  their own machine — but a routine firing unattended on a subscription
  is close enough to that line to confirm with Anthropic before it ships.
  The fallback is an API key the person sets for runs (`ANTHROPIC_API_KEY`
  or `apiKeyHelper` in the run's environment), which the catalog block
  can carry without a protocol change.
- **Streaming input and approvals** (the Agent SDK's `canUseTool` and
  `AskUserQuestion`) would let a run ask a person mid-turn — in the
  console, in Linear, in Slack — instead of denying. Worth it once reply
  bindings exist; it means a Node helper on the host or `--input-format
  stream-json` from Go.
- **`auto` for headless runs**: keep `acceptEdits`, or map it to Claude
  Code's classifier mode, which reviews each action instead of denying
  every shell command outside the read-only set (§3).
- **Concurrency**: how many headless runs a host takes at once, and
  whether they count against the same budget as interactive sessions.
