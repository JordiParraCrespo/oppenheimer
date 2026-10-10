# Lessons from Synara and OpenClaw

Two codebases read to answer one question: how do they show a
conversation with Claude Code or Codex so well, when we show a terminal?
`Emanuele-web04/synara` (TypeScript, read at `eaa61ed`, 2026-09-22) and
`openclaw/openclaw` (TypeScript + Swift, read at `1c9ffa53`,
2026-09-23). Neither is a competitor on hosts or worktrees. Both are
the prior art for a **structured chat view** over coding agents. This
note is the read and decides nothing: the session view is the terminal
(`versions/mvp/00-scope.md`), and whether a session is also shown as a
chat is the question
[`next-steps/0.7-terminal-and-chat.md`](../next-steps/0.7-terminal-and-chat.md)
owns. Paths in backticks are relative to `product/`.

## 1. The one fact worth the read

Neither of them renders a terminal. Both drive the agent through its
**machine interface**, and draw every pixel of the conversation
themselves, from typed events.

| | Synara | OpenClaw |
|---|---|---|
| Claude Code | Claude Agent SDK `query()` with `includePartialMessages: true`; one long-lived `claude` process fed by an async iterable of user messages (`apps/server/src/provider/Layers/ClaudeAdapter.ts`) | the `claude` CLI itself: `--print --input-format stream-json --output-format stream-json --include-partial-messages --permission-prompt-tool stdio` (`extensions/anthropic/cli-transport.ts`, `cli-runtime-args.ts`) |
| Codex | `codex app-server`, JSON-RPC over stdio: `initialize` → `thread/start` or resume → `turn/start` (`apps/server/src/codexAppServerManager.ts`) | the same, `codex app-server --listen stdio://` (`extensions/codex/src/app-server/client.ts`), with ACP as a second route; the server also listens on a Unix socket with `--listen unix://PATH` (codex-cli 0.144) |
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
(`versions/mvp/02-runner.md` §1, §6; [`lessons-from-herdr.md`](lessons-from-herdr.md)). Both of these projects
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

## 4. Questions it leaves for 0.7

The read stops at what they do and what it costs. If 0.7 wants a chat
view, these are the questions it starts from, and the answers belong in
the notes that own the session (`versions/mvp/01-protocol.md` for any
event schema, `02-runner.md` for what holds the agent's pipes), not
here:

1. **Process survival.** Can a driven agent keep the guarantee tmux
   gives a terminal session, surviving a runner update? Both projects
   above give it up.
2. **Subscription terms.** Note 01 settled that people log in to
   `claude` and `codex` as they would on a laptop. Is driving the CLI in
   stream-json or app-server mode, on the person's own machine with
   their own login, covered the same way?
3. **Where the translation lives.** Next to the agent on the host, or
   in the control plane next to the other readers of the protocol?
4. **What is worth taking regardless.** Synara's classification of
   Claude's tools into typed items (Bash as a command, TodoWrite as a
   task list, ExitPlanMode as a plan), paced and smoothed streaming, and
   the stable-head and repaired-tail split for streaming markdown are
   craft any chat view needs, whatever the transport.
