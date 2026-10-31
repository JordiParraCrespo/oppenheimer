# Lessons from Codex's and Grok's chat

One question, read on 2026-10-31: what do Codex and Grok do better than
our two chat stacks (the bots chat in `apps/web/src/features/bots/` and the
session chat over a Claude Code transcript in `…/features/sessions/`), and
how do they organise the code behind it?

- **Codex**: `openai/codex`, the open-source repository, shallow clone of
  `main` on 2026-10-31. Read in code; paths are relative to `codex-rs/`.
- **Grok**: the web app at grok.com, closed source. Only the public,
  logged-out HTML and the JavaScript chunks it loads were read (Next.js
  16.4 with Turbopack, no source maps served). The chunks embed the
  protobuf descriptors of its chat service, so the wire format is read
  exactly; component internals are inferred from strings and i18n keys.
  The Grok Bot desktop app is a different product, read in
  [`lessons-from-grok-bot.md`](lessons-from-grok-bot.md).

The note decides nothing. What it led to is
[`next-steps/0.7-chat-protocol.md`](../next-steps/0.7-chat-protocol.md).

## 1. The one fact worth the read

Both draw every pixel from a **typed item stream with a lifecycle**, and
both treat the stream as a preview of a record that wins in the end.

- Codex: a thread holds turns, a turn holds items, and an item goes
  `item/started` → deltas keyed by `{threadId, turnId, itemId}` →
  `item/completed`. "The completed plan item is authoritative and may not
  match the concatenation of PlanDelta text"
  (`app-server-protocol/src/protocol/v2/item.rs`). Items are a tagged
  union: user message, agent message, reasoning, command execution (with
  server-parsed `command_actions`), file change, MCP call, subagent, plan,
  context compaction.
- Grok: `OutputChunk` is a oneof of text (with a channel: response or
  thinking), tool usage card (about 60 tool kinds, status in progress /
  completed / incomplete / failed), tool result, user input request
  (permission or question), citation, progress report, phase marker,
  follow-up suggestions and render chunks for images, charts and apps.

Ours: the bots chat streams text deltas and otherwise tells the client to
read the conversation again; the session chat gets whole transcript lines.
The two group messages into turns and label tools each their own way.

## 2. What they do better

1. **One protocol for every surface.** Codex's TUI, its headless `exec`
   and its SDKs all speak app-server JSON-RPC; the TUI runs the server in
   process (`app-server-client/src/lib.rs`) or talks to a remote one over
   a WebSocket. TypeScript types and JSON Schema are generated from the
   Rust definitions (`codex app-server generate-ts`).
2. **Lossless reconnect.** Grok's `reconnect-response-v2/{responseId}`
   expects its first NDJSON chunk to be the full state ("No initial state
   received from reconnect") and then tails deltas; a reload reattaches to
   a reply in flight. Our bots stream drops what was published while the
   browser was away.
3. **Exploration folds.** Codex groups a run of read-only commands (Read,
   ListFiles, Search, as the server parsed them) into one `• Explored`
   cell, duplicate reads merged (`tui/src/exec_cell/model.rs`). Grok's
   thinking canvas has an "Explored" group too.
4. **Bounded output, two depths.** A Codex command shows at most five
   lines with `… +N lines`; the full transcript (Ctrl+T) has everything.
   Live output is held to 1 MB, head and tail kept, each line cut head and
   tail (`tui/src/exec_cell/live_output.rs`).
5. **Approvals are requests.** Codex's approval is a JSON-RPC request
   from server to client carrying `available_decisions` (accept, accept for
   the session, amend the exec policy, decline and continue, cancel the
   turn); when any client answers, `serverRequest/resolved` closes the
   prompt everywhere else (`tui/src/bottom_pane/approval_overlay.rs`).
   Prompts and tool cells wait until the assistant's sentence finishes
   streaming (`tui/src/chatwidget/interrupts.rs`).
6. **Steer, queue, rewind.** While a turn runs, Codex's Enter steers
   (`turn/steer`, injected at the next tool boundary) and Tab queues; the
   pending list above the composer shows both, editable. Esc Esc walks back
   to an earlier prompt, `thread/rollback` reverts to before it and the
   prompt returns to the composer. Grok keeps a message tree
   (`parentResponseId`, `selectedBranchByParent`) for edit and regenerate.
7. **Streaming markdown with holdback.** Codex commits at newlines, keeps a
   stable prefix and a mutable tail, holds back tables, fences and diagrams
   until their block ends, and paces commits smooth / catch-up with
   hysteresis (`tui/src/streaming/`). Grok renders with Streamdown and
   throttles store writes during a stream.
8. **Live and replay through one reducer.** Codex's
   `handle_server_notification(notification, replay_kind)` draws a resumed
   thread exactly as a live one; history loads the last five turns and
   pages back by a hundred items.
9. **Tests of what is drawn.** About 1,468 snapshot files: recorded
   protocol events replayed into the real chat widget, rendered into a
   vt100 emulator, the screen snapshotted (`tui/src/chatwidget/tests/`,
   `tui/tests/suite/vt100_*.rs`). We test grouping logic, not
   `BotTranscript`, `BotTurn` or `BotReply`.

## 3. How they organise the code

- **Codex** keeps the agent core, the internal protocol, the public
  protocol, the server, its transports and each UI in separate crates. In
  the TUI, a transcript entry is one `HistoryCell` with several renderings
  (compact, transcript, raw, its markdown source) and stable activity ids
  so folding survives regrouping (`tui/src/history_cell/mod.rs`). Each
  state machine (composer, paste burst, stream controller) opens with a
  module doc that a local `AGENTS.md` requires to stay current.
- **Grok** is close to our stack: React 19 with the React Compiler,
  Tailwind v4, Base UI and Radix, TanStack Query, Zod, i18next. State is a
  dozen small zustand + immer stores named by feature (`response-store`,
  `message-store`, `conversation-store`, `modes-store`, `file-store`…),
  with `store:action` names in telemetry; i18n keys are namespaced by
  component; heavy renderers (Shiki, KaTeX, Mermaid, Tiptap, PDF, a data
  grid) load lazily; the REST client is generated. Its chat service also
  describes a coding workspace (files, git staging and commit, per-hunk
  accept and reject, worktrees, rewind), the same shape as this product.

## 4. What we already have

One component draws history and the live turn in the bots chat; stream
frames are Zod-validated; event kinds map to components through one typed
table; the composer's chips are elements passed in, so typing does not
re-render them. The gaps are in the model and the protocol, not the stack.
