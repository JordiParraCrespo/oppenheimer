# 16 — Lessons from DigitalOcean Managed Agents

DigitalOcean put Managed Agents into public preview on 2026-09-22: a
Firecracker microVM per agent session, paused when idle, with Claude
Code, Codex, OpenCode, Cursor, Hermes, LangGraph or a custom image
inside. It is the runtime note 15 designs, sold as a service, so it was
read twice: first from the public docs, then from the source of its two
open clients, to see what was worth carrying over.

What was read: `doctl` at commit `59d79dc` (2026-09-23), the `godo` SDK
vendored inside it, and `pydo` 0.41.0 from PyPI. All three are
Apache-2.0. The server is closed, so everything here is what the clients
show about it; anything inferred says so. No DigitalOcean API was
called. Concepts are carried over, not code.

## 1. What it is

- **Harness Runtime.** A session is one microVM. A YAML spec picks the
  adapter (`claude-code`, `codex`, `opencode`, `cursor`, `hermes`,
  `langgraph`, `codex-agentapi`, `custom`), a size (1 vCPU / 1 GB up to
  16 vCPU / 32 GB), `persistent_workspace`, `idle_timeout` or
  `keep_warm`, an egress allowlist, secrets, MCP tools, skills and a
  permission policy (`allow | ask | deny` per action type).
- **Lifecycle.** `PROVISIONING → READY ⇄ PAUSED → DESTROYING →
  DESTROYED`, plus `DETACHED` and `FAILED`. A session holds many
  *runs*, one at a time. Idle sessions pause after 15 minutes, never
  mid-run; a pause freezes memory, processes and disk, and they quote a
  305 ms resume. Checkpoints (disk and memory, only between runs), fork
  into up to four copies, roll back in place.
- **Around it.** Cron and webhook triggers, exec, port forwarding, file
  transfer, and Action Gateway: 16,000 tools behind one MCP endpoint
  with credentials brokered outside the sandbox.
- **Where and what it costs.** One region (RIC1, US East). $0.044 per
  vCPU-hour and $0.0095 per GB-hour; "active CPU" billing is announced
  but not live, so today it bills 25 % of the allocated vCPUs, which is
  about $0.06 an hour for the default 2 vCPU / 4 GB. Storage and
  checkpoints $0.05 per GiB-month, egress $0.01 per GiB, prepaid only.

## 2. The fact that decides whether we can use it

**Every model call is paid with an API key the platform holds.**

- The `claude-code` adapter takes `ANTHROPIC_API_KEY` as a secret, and
  doctl checks it against Anthropic before it creates the session.
- The `codex` adapter takes `OPENAI_API_KEY` and writes it into
  `.codex/auth.json` in the guest on every run.
- The local proxy that lets a native Codex TUI drive a hosted session
  stubs `account/read` with "no OpenAI auth required" and never relays
  `account/login/*`: the TUI's own ChatGPT login plays no part.
- `codex-agentapi` hands the loop to OpenAI's Agents API, on two OpenAI
  API keys.
- There is no Claude Code proxy; the code lists it as future work.

That is the opposite of `versions/mvp/00`'s *Done means* (the person
logs in to their own subscription inside the machine; no vendor
credential is stored by the platform). As a runtime it is out. The only door left is the
`custom` adapter running our own runner, and whether a CLI can finish
its own login there, and keep it across a pause, is unverified. The
value of the read is the list below.

## 3. How they built it

**One event log per session, streamed as SSE.** Every event carries
`{event_id, run_id, session_id, seq, timestamp, type, data}`, and
optionally the native frame it was translated from. Types:
`run.started`, `run.token_delta`, `run.tool_call_started|completed`,
`run.human_input_requested|received`, `run.completed|failed`,
`run.paused|resumed`, `run.state_checkpointed`, `run.log`,
`session.updated`, and usage and cost events. One route serves two
modes: live, resumed with the `Last-Event-ID` header, and
`replay_only`, a finite history read that pages backwards with
`before` and `limit` and ends with a `has_more` comment.

**A stream-health frame.** `stream.state` is `catching_up` (replaying
history), `live`, `degraded` (the server fell back to polling) or
`superseded` (a newer connection from the same device took over; do not
reconnect, or the two evict each other).

**Backfill, then live.** The CLI reads the history to its end first,
renders it, sets its cursor to the last event, and only then opens the
live stream, so there is nothing to deduplicate at the seam. The Python
SDK subscribes before it sends input, so it cannot miss its own run.

**A reconnect policy with two kinds of failure.** Backoff 1 s doubling
to 30 s, at most five consecutive failures; a connection that stayed up
30 s counts as a server idle close and resets the budget; 401, 403, 404
and 409 are terminal and never retried.

**Approvals are records.** `{request_id, run_id, action, details,
workdir, deadline}`; outcomes approve, reject or defer; the source is
recorded as inline keystroke or out of band. A pending request is sent
again on reattach, an answer from another device clears it everywhere,
and the end of a run cancels whatever is still pending. MCP form
elicitations ride the same object.

**Lessons from their native-TUI proxy**, each learned the hard way and
written in the code:

- never offer a choice the backend cannot honour (they removed the
  field that made Codex show "don't ask again");
- a request whose answering side has gone is settled, never left
  hanging;
- a server-side timeout on an approval was tried and reverted, because
  the protocol cannot take back a prompt the TUI already shows;
- the "answered" state comes from the agent's acknowledgement, not from
  the proxy's own write, which is what makes an answer from a second
  device reconcile;
- one client per proxy, loopback only, an Origin check, every request
  gets a reply, and anything unknown is logged as `unhandled:` against
  a pinned protocol version.

**Wake on use.** `prompt` and `port-forward` resume a paused session
and wait for `READY` before sending, because "input to a session that
is awake but not yet listening loses the prompt". A failed send puts
the typed text back in the composer.

**Smaller pieces.** A pause reason next to the state (`manual | idle |
low_balance`, an open string clients pass through). Exec is
`{argv, workdir, timeout}` returning buffered output, with HTTP retries
turned off because a retried exec runs twice. Port forwarding is one
WebSocket per TCP connection carrying opaque binary frames, remote
ports 1024 and up only. File transfer is staged through presigned
multipart URLs with a SHA-256 checked at both ends, and downloads end
with an integrity footer because proxies strip HTTP trailers. Triggers
record every firing as an execution row, bind either a fresh or a
paused session, and rotate their webhook secret with a grace window.
Environment configs are immutable and hashed, and each session keeps
the id it was made from. Spending consent is set per session and never
inherited from a shared config.

**Where we are already ahead.** Their clients show no idempotency key
on create (a retried create can provision twice), opaque random event
ids, and 409s classified by matching message text. We have
`Idempotency-Key` on create, a gapless `seq` under a lock, an event key
with `ON CONFLICT DO NOTHING`, and RFC 7807 codes.

## 4. What we take, ranked

Each item names the notes it would change. None of them is decided
here.

1. **Agent state from hooks, and approvals as objects.** This is the
   hook half of `versions/mvp/02` §9 that is still to build, and it
   answers `05` open question 2 (what "blocked" looks like).
   - A `runner hook <event>` subcommand, the same shape as the
     credential helper, installed as Claude Code's hooks at launch and
     reporting to the runner's socket with the session id from the tmux
     environment. Notification, permission request, Stop and prompt
     submit are the events that matter (to verify against Claude Code's
     hook contract).
   - New event kinds on `events.append`: `agent.turn.started`,
     `agent.turn.completed`, `agent.awaiting_user`,
     `approval.requested {key, tool, summary, options}`,
     `approval.resolved {key, outcome, source: terminal | remote}`.
   - Answering from a phone: through the hook's decision output if
     Claude Code allows it (to verify), otherwise the TUI's own
     keystroke, and the runner re-checks **by key** that the prompt is
     still on screen immediately before typing, so a late "approve"
     never lands in the composer as text.
   - DigitalOcean's rules come with it: first answer wins, an orphaned
     request is settled, no "always allow" we cannot honour, the source
     is recorded.
   - Changes `02` §9, `01` (event kinds, how `input` answers an
     approval), `03` (event kinds, the derived group), `05` (an
     approve/reject card in the sidebar and on the phone), the CLI and
     MCP (`sessions approve`).
2. **A resumable event feed for the console.** `GET
   /sessions/{id}/events` is a read today, and nothing says how the
   console hears new events live. Add `?after=<seq>` and
   `?before=<seq>&limit=` (default 200), and an SSE form of the same
   route with `id: <seq>`, so a browser `EventSource` resends
   `Last-Event-ID` on its own; our gapless `seq` is a better cursor than
   their random ids. Emit `catching_up` / `live`, and put
   backfill-then-live in the web client. Changes `03` routes, `10`'s
   route table and `01` §Parties, which says two sockets.
3. **A reconnect policy for the browser attach socket.** `01` has a
   ladder and an epoch for the runner link only. Name which close codes
   are terminal (a revoked ticket, a deleted session) and which are not
   (`host_offline`), reset the budget after a healthy connection, give a
   tab a client id so a reconnecting tab replaces its own stale
   attachment (still several viewers per pane, unlike their one per
   device), and add a `replay_end` hint where the scrollback tail stops.
   Changes `01` §Flow control and the hint vocabulary, `03` §The relay.
4. **Idle means between turns, and the reason is a column.** With the
   hooks above, idle becomes "the turn ended and nobody typed for N
   minutes" instead of terminal silence, and a long unattended run can
   never be called idle. A `stopReason` (`manual | idle | host_stopped
   | host_lost | reboot`) folded from `session.stopped`, passed through
   when unknown. Changes `12` §6 and §7, `15` §3, `03` §Cloud hosts,
   `10`.
5. **Wake on use.** Input to a stopped session (the composer with no
   pane open, the CLI, a later port forward) resumes it first and waits
   for `session.started` before typing, and a failed send gives the
   text back. Changes `03` and `12`.
6. **For the Codex slice: a tee, not a facade.** The runner supervises
   `codex app-server` on loopback and window 0 runs `codex --remote`
   through a runner relay that forwards every frame untouched and
   mirrors notifications and approval requests into events. The real
   app-server answers `account/*`, so the person's ChatGPT login works
   (inferred; to verify). From doctl: loopback bind and an Origin check,
   one client, every request answered, a pinned version and an
   `unhandled:` log. Open: whether the app-server tells a second client
   that a request was resolved, which answering from a phone needs.
   The WebSocket transport is marked experimental. Changes `02` §5.
7. **Port forwarding as an attachment kind** (the preview slice). A
   forwarded port is one more attachment id on the link; the runner
   dials `127.0.0.1:<port>` on the host, or the guest over vsock under
   `15`. The ticket goes in `Sec-WebSocket-Protocol`, since browsers
   cannot set headers. Stricter than theirs because a host may be
   someone's laptop: ports 1024 and up, and only ports a session's own
   processes listen on. Changes `01`, `03`, `05`, `07`.
8. **Checkpoint, fork and rollback on reflinked disks** (after v0.2's
   first cut). Disk only: a checkpoint is a reflink of the session disk
   taken between turns after a guest `sync`, recording the log `seq`. A
   fork is a new session on a reflinked copy with its own branch, the
   agent relaunched with its resume and fork flags (to verify). A
   rollback swaps the disk and keeps the id. Changes `15` §3, `02` §14,
   `03`, `10` (`parentSessionId`, a checkpoint table), `12` §5 and §8.
9. **Later, in their own slices.** An exec verb for the CLI and MCP
   (`session.exec`, a `sessions:exec` scope, never retried). File drop
   into a worktree with a SHA-256 at both ends, mainly for a phone
   screenshot. Triggers with an execution row, fresh or reuse sessions
   and secret rotation with a grace window, for the routines slice.
   Immutable hashed project setups a session keeps the id of. Their
   token-prefix and credential-name heuristics, to redact `prompt.first`
   and event payloads before they are stored.

## 5. What we do not take

- **API keys, secrets in manifests, the OpenAI bridge, Action Gateway.**
  All of it makes the platform a holder of vendor credentials (§2).
- **A renderer built from translated events, and impersonating the
  agent's backend.** Their chat view and their proxy both rebuild the
  agent's screen from a lowest-common-denominator event set and lose
  diffs, command output and reasoning. We stream the real TUI; events
  only annotate it. For the same reason Claude Code's `stream-json` is
  not our channel: it is headless print mode and replaces the TUI.
- **One stream per device, and 409 "attached elsewhere".** A laptop and
  a phone on the same pane is a feature (`01` attachments).
- **Memory checkpoints, for now.** `15` chose disk-only resume. Their
  305 ms resume is the evidence to weigh when `15` §5's snapshots come
  up, not a reason to change v0.2.
- **Prepayment and metering**, a blanket `--on-hitl` auto-answer (our
  permission modes already say it), auto-rejecting file edits (their
  workaround for one protocol), "allow always" emulated in proxy
  memory, classifying errors by message text, and a client keepalive
  (the runner reports; the control plane decides idle).

## 6. The one decision this raises

An activity feed and approvals persist more of the agent's work than
the rule "the transcript never leaves the host" (`02` §5, `10`)
allows today. The suggestion is metadata only: tool name, command,
status and timestamps, never message text, with full items streamed
only to an attached viewer the way the PTY is. Not decided here; when
it is, it goes in `02` §5 and `10` and on the decisions list in the
README.

## 7. Verdict

DigitalOcean confirms the shape of `15`: a microVM per session, idle
means paused, credentials outside the guest. It cannot be our runtime
while every path is an API key. What it teaches is the layer above the
VM that we have not designed yet: a session event log you can resume,
approvals as records you can answer from anywhere, idle measured
between turns, and a reconnect policy that knows which failures are
final. Items 1 to 3 are the ones to design next, because the console
needs them whether sessions run on a laptop or in a microVM.

## Sources

- Announcement: <https://www.digitalocean.com/blog/managed-agents-public-preview>
- Docs, read 2026-09-22:
  <https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/>
  (agent adapters, sessions, environment spec, approvals, permissions,
  egress, secrets, custom templates, checkpoints, Codex proxy, OpenAI
  Agents API sessions, pricing, limits, availability)
- `doctl`: <https://github.com/digitalocean/doctl> at `59d79dc`,
  `commands/agents*.go`, `commands/agent_*.go`, `internal/agentproxy/`
- `godo` (vendored in doctl): `hosted_agents.go`,
  `hosted_agent_checkpoints.go`, `hosted_agent_triggers.go`,
  `hosted_agent_configs.go`, `hosted_agent_templates.go`
- `pydo` 0.41.0: <https://pypi.org/project/pydo/>, `pydo/agents/`
