# 14 — Lessons from Synara and OpenClaw: a chat view for the next version

Two codebases read to answer one question: how do they show a
conversation with Claude Code or Codex so well, when we show a terminal?
`Emanuele-web04/synara` (TypeScript, read at `eaa61ed`, 2026-09-22) and
`openclaw/openclaw` (TypeScript + Swift, read at `1c9ffa53`,
2026-09-23). Neither is a competitor on hosts or worktrees. Both are
the prior art for a **structured chat view** over coding agents, which
this note puts in the **next version**, after the MVP. The MVP is
unchanged: its session view is the terminal (`versions/mvp/00-scope.md`).

## 1. The one fact worth the read

Neither of them renders a terminal. Both drive the agent through its
**machine interface**, and draw every pixel of the conversation
themselves, from typed events.

| | Synara | OpenClaw |
|---|---|---|
| Claude Code | Claude Agent SDK `query()` with `includePartialMessages: true`; one long-lived `claude` process fed by an async iterable of user messages (`apps/server/src/provider/Layers/ClaudeAdapter.ts`) | the `claude` CLI itself: `--print --input-format stream-json --output-format stream-json --include-partial-messages --permission-prompt-tool stdio` (`extensions/anthropic/cli-transport.ts`, `cli-runtime-args.ts`) |
| Codex | `codex app-server`, JSON-RPC over stdio: `initialize` → `thread/start` or resume → `turn/start` (`apps/server/src/codexAppServerManager.ts`) | the same, `codex app-server --listen stdio://` (`extensions/codex/src/app-server/client.ts`), with ACP as a second route |
| History | `~/.claude/projects/*.jsonl` read **only to import old sessions**, never for live chat | the gateway's own transcript store |

Everything that makes the result look good sits on top of that choice.
None of it can be done with scraped screen output.

## 2. What makes it look good

1. **One neutral event model, one adapter per agent.** Synara's
   `packages/contracts/src/providerRuntime.ts` is the best example of
   the idea:
   - text deltas typed by stream kind (`assistant_text`,
     `reasoning_text`, `plan_text`, `command_output`,
     `file_change_output`);
   - items with a canonical type (`assistant_message`, `reasoning`,
     `command_execution`, `file_change`, `mcp_tool_call`,
     `collab_agent_tool_call`, `web_search`, …) and a
     started / updated / completed lifecycle;
   - `request.opened` / `request.resolved` for approvals and questions;
   - `turn.diff.updated`, `turn.tasks.updated` (todos) and proposed
     plans.

   Claude's tools are **classified** into those types: Bash becomes a
   command, Agent becomes a sub-agent call, TodoWrite becomes a task
   list, ExitPlanMode becomes a plan card. OpenClaw does the same with
   an event projector per backend (`extensions/codex/src/app-server/event-projector*.ts`).
2. **Tool calls are cards, not text.** A card per call, collapsed to a
   one-line summary with an icon and an outcome. Runs of consecutive
   calls fold into one group row (Synara's `ToolCallGroupSummaryRow`).
   Edits open as diffs, todos as a live checklist, plans as a card with
   accept and reject.
3. **Cards fill in before the call finishes.** Synara accumulates the
   `input_json_delta` fragments of a tool's arguments and re-parses them
   after each one, so the card shows `npm test` while the model is
   still writing it.
4. **Streaming is paced, then smoothed.**
   - The server paces deltas (OpenClaw every 75 ms, dropped for a slow
     client; Synara batches for 100 ms and coalesces deltas of one
     message into one event).
   - The browser reveals the text on animation frames at a speed that
     tracks the backlog (Synara's `useSmoothStreamedText`), which hides
     the clumps.
5. **Half-written markdown does not break the layout.** OpenClaw splits
   the streaming message into a stable head, rendered once, and a tail
   repaired with `remend` so an unclosed fence or table stays readable.
   Synara defers the re-parse with `useDeferredValue` and throttles
   code highlighting while a message streams.
6. **Rendering stack.**
   - Synara (React 19): `react-markdown` with GFM and KaTeX, Shiki for
     code, `@pierre/diffs` for diffs rendered in a Web Worker pool.
   - OpenClaw (Lit): `markdown-it` with DOMPurify, highlight.js,
     Mermaid, and native SwiftUI views for its Mac and iOS apps.
7. **Long transcripts stay fast.** Both virtualize the list: Synara
   with `@legendapp/list` and `maintainScrollAtEnd`, OpenClaw with
   `@tanstack/lit-virtual`. Both follow new output only while the
   reader is near the bottom. Synara also scrolls a just-sent message
   to the top of the view, so the answer grows beneath it.
8. **Approvals are UI.**
   - The adapter holds the agent's request open: Claude's
     `canUseTool`, or Codex's `item/*/requestApproval` JSON-RPC request.
   - The browser shows an approve / deny panel.
   - The answer travels back over the WebSocket and resolves the
     waiting request.

## 3. What that choice costs, for us

**Process survival.** Our runner puts tmux between itself and the
agent, so an update or a rollback leaves the agent running
(`versions/mvp/02-runner.md` §1, §6; note 13). Both of these projects
make the agent a **child of the server holding its pipes**.

When that server restarts, the agent dies. Synara treats exit 143 as
"Claude runtime stopped and will resume on your next message"
(`ClaudeAdapter.ts:805`), then resumes by session id. It is herdr's
trade again: the conversation survives, the process does not, and a
turn in flight is lost.

**Terminal parity.** A driven agent has no TUI. Slash commands, login,
`/model`, and anything else the CLI only offers interactively have to
be rebuilt as UI, or are simply absent.

**Transcripts leave the host.** Today the runner reads the agent's
transcript and sends one line of it (`versions/mvp/10-api-modules-and-data-model.md`).
A chat view sends the whole conversation to the browser. That is no
more than the terminal bytes already carry through the relay, but the
security note should say so in words.

## 4. Direction for the next version

A session gets a **mode at creation: Terminal or Chat**. Terminal is
today's session, unchanged. Chat is a driven agent with a structured
view.

1. **The driver lives inside tmux, not inside the runner.** A small
   `runner agent-host` subcommand runs in window 0 of the session's
   tmux session. It owns the agent's pipes and serves the event stream
   on a Unix socket under `~/.oppenheimer/run/`. The runner connects to
   that socket, and reconnects after its own restart. The agent keeps
   running across a runner update, the same guarantee terminal sessions
   have.
   - Codex already supports this shape: `codex app-server` accepts
     `--listen` and `--sock`, so it may not need the shim at all.
2. **Claude through the CLI's stream-json, not the SDK.** The runner
   is Go, and the Agent SDK is TypeScript or Python. The two-way
   stream-json mode OpenClaw uses (flags in §1) is the SDK's own wire,
   is language-neutral, and keeps the dependency to the `claude` binary
   the host already has. Permissions go over the same channel
   (`--permission-prompt-tool stdio`, `control_request` /
   `control_response`).
3. **One event schema in `packages/shared`,** shaped like Synara's
   `providerRuntime.ts`: stream kinds, canonical item types with a
   lifecycle, requests, diffs, tasks. Each agent gets an adapter in the
   runner that maps its native stream onto that schema. The adapters
   are the only agent-specific code, the same way manifests are for
   terminal sessions.
4. **Deltas are live, the transcript is the record.**
   - The runner paces and coalesces deltas before they leave the host.
   - The control plane relays them and stores nothing, the same posture
     as the terminal ring buffer (F12).
   - A reopened tab is rebuilt from the agent's own transcript on the
     host (`--resume` for Claude, `thread/resume` for Codex), plus the
     live tail.
5. **An escape hatch to the terminal.** When no turn is running, a
   Chat session can be opened in the terminal with `claude --resume <id>`
   (or Codex's equivalent) in a new tmux window. That covers what the
   view does not rebuild. The two never drive the same session at once.
6. **Take the craft, not the frameworks.** The console is already
   React 19 on the design system, so the pieces map directly:
   - Synara's choices where they fit: a virtualized list that follows
     the end, a smooth reveal, Shiki, a worker-rendered diff view.
   - OpenClaw's stable-head / repaired-tail split for streaming
     markdown.
   - Tool cards and approval panels built as design-system components,
     not bespoke markup.

A read-only chat view of *terminal* sessions, rendered from the
transcript file, is the cheap fallback if Chat mode slips. It would
show whole messages only (no deltas), and approvals would stay in the
terminal.

## 5. Open questions

1. **Subscription logins in a driven session.** Note 01 settled that
   people log in to `claude` and `codex` as they do on a laptop. Check
   against the vendors' current terms that driving the CLI in
   stream-json or app-server mode on the user's own machine, with the
   user's own login, is covered the same way before building on it.
2. **Where the adapters live.** In the runner (Go, next to the agent,
   one hop fewer) or in the control plane (TypeScript, next to the
   schema's other readers)? Leaning runner: the host already owns
   everything agent-specific.
3. **Mode switching.** Should a Terminal session be convertible to Chat
   by resuming its agent session id, or is the mode fixed at creation?
4. **State dots.** A Chat session reports its state from events rather
   than manifests. The sidebar must not care which one produced it.
5. **Scope of the first cut.** Claude only, or Claude and Codex
   together? Codex's app-server is the cleaner protocol, and Codex is
   the next slice anyway.
