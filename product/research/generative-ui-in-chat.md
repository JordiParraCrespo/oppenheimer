# Generative UI and tools in the chat: openbot, ChatGPT for Linux, OpenClaw

Research, 2026-11-24. It decides nothing. The owner asked for a read of
openbot's generative UI and of the tools in the ChatGPT desktop app for
Linux, then of OpenClaw, with a view to porting what fits into our chat.
It follows [`visuals-in-the-chat.md`](visuals-in-the-chat.md) (2026-11-09), which
read Synara and an earlier ChatGPT build for charts and HTML only. This
note reads the newer build for its whole tool list, and adds openbot and
OpenClaw. Paths in backticks are inside the source named beside them;
ours are relative to the repository.

Nothing was copied. The ideas are rebuilt in our own code, as
`.agents/answers.md` (2026-11-16) asks.

## 1. The answer in short

All three converge on the same two-layer shape, and our chat has the
first layer and none of the second.

1. **A kind for every tool, with a fallback.** Each one maps a tool name
   to a kind (command, read, edit, write, search, fetch, plan, question,
   subagent, MCP) and draws a row per kind, with raw JSON for anything
   unknown. OpenClaw's table even lists Claude Code's and Codex's
   spellings. Ours (`packages/frontend/consumer/src/modules/chat/chat-tools.ts`)
   is the same design, and as complete as theirs for reading a transcript.
2. **UI the agent asks for.** This comes in three forms, and each product
   has at least two of them:
   - **Decision cards that block the turn:** approve, choose, fill a form.
   - **Typed data blocks drawn by the host:** charts, metrics, tables,
     checklists, progress.
   - **HTML the agent wrote, in a sandbox on another origin.**

   Declarative component trees (A2UI and the like) are the one approach
   in retreat: OpenClaw removed A2UI on 2026-11-05 in favour of plain
   HTML.

What to port, in order (§6):
- **Permission approval cards in the session chat.** All three have
  them; we have only a status line. This is the largest gap that a user
  of a session meets today.
- **One typed block format** for bots and sessions. The three products
  agree on its contents closely enough to pick them.
- **A form decision tool for bots.**
- **The live output tail on a running command.**
- **The HTML frame.** OpenClaw built independently the shape that our
  proof of concept in `spikes/visuals-poc/` measured.

What not to port: A2UI, ChatGPT's internal widget catalogue, and the
CopilotKit runtime.

## 2. What was read

| Source | How it was read | Standing |
|--------|-----------------|----------|
| openbot, `CopilotKit/openbot` v1.1.3, MIT; with `CopilotKit/generative-ui` and `CopilotKit/OpenGenerativeUI` | Shallow clones, read only. The server half (Hono) ships only as a Docker image, `ghcr.io/copilotkit/openbot` | The client: read directly. The server: docs and code comments only |
| ChatGPT desktop app for Linux `26.1117.41037`, `chatgpt_amd64.deb` from `persistent.oaistatic.com/codex-app-prod/linux/deb/latest/` (534,451,850 bytes, sha256 `830e251b…2692`, last modified 2026-11-20) | `dpkg-deb -x`, `app.asar` extracted (about 9,600 renderer chunks), the `codex` binary read with `strings`. Nothing was started | Read directly. The code is minified, so component names are inferred from i18n keys and item-type strings |
| OpenClaw, `openclaw/openclaw` at `57dd84bd` (2026-11-24); tag `v2026.10.10` (`7dc3350c`) for A2UI before its removal | Shallow clones, read only | Read directly, except the Codex bridge of `show_widget` (docs only) |
| This repository | Both chats, `chat-tools.ts`, `chat-blocks.ts`, `session-chat.ts`, `agent-activity.ts`, the bots' tool factory | Read directly |

## 3. openbot

A self-hosted workspace of "AI coworkers". Each bot is an AG-UI endpoint;
one of its fourteen harnesses is the Claude Agent SDK. The client is
React on CopilotKit v2.

**A gallery of typed cards.** These are frontend tools, one file each in
`app/src/components/gallery/`, each with a Zod schema, a description the
model reads, and a component. They are registered through
`useFrontendTool` by `gallery-registry.ts`.

| Tool | Arguments | Blocks the turn |
|---|---|---|
| `showBarChart`, `showPieChart` | `title`, `points[{label, value}]`, `sources` | |
| `showLineChart`, `showAreaChart` | `title`, `labels[]`, `series[{name, values[]}]` | |
| `showProgress` | `points[{label, value, target}]` | |
| `showMetrics` | `title`, `caption?`, `metrics[{label, value}]` | |
| `showRecord` | `title`, `status?`, `fields[{label, value}]` | |
| `showChecklist` | `title`, `items[{text, done, note?}]` | |
| `showTable` | `title`, `caption?`, `columns[]`, `rows[][]` | |
| `showNotice`, `showQuote` | text fields | |
| `askApproval` | `title`, `summary`, `details[]?`, `command?`, button labels | Yes: approved, declined, or other with a note |
| `askChoice` | `title`, `options[{id, label, description?}]` | Yes: a choice or free text |
| `askForm` | 1 to 8 fields: text, email, number, select, textarea | Yes: the values |

Three of its mechanics are worth naming:

- **Half-written arguments are drawn as they arrive.** `settled-args.ts`
  holds back only the last leaf while it streams, and only when that leaf
  is a number, a URL or a colour. A bar headed for 125 never flashes 12;
  half-typed text is shown as it is typed.
- **One answer slot per tool call.** `useDecisionTool`
  (`gallery-tools.tsx:343`) keeps a promise per `toolCallId`. The card
  resolves it, and the value becomes the tool's result. openbot left the
  SDK's own hook because that hook keeps one slot per tool, so two
  approvals waiting at once got each other's answers.
- **Refusals survive a reload.** A card the user's grants do not allow
  is answered with `Not shown: …`, and a reloaded transcript draws a
  refusal from that prefix.

**Other generators.** These are gated by `OPENBOT_GENERATIVE_UI`:
- `generateSandboxedUi`: HTML, CSS and JavaScript streamed into
  `@jetbrains/websandbox`, which draws the CSS first, scripts last.
  Scripts may load from four CDNs, and the page reaches back through
  `sendPrompt`.
- A2UI 1.0: CopilotKit's catalogue, with a few parts removed and one
  editable `Breakdown` added.

**Render-only views of Claude Code's tools.** These are in
`coding-tools.tsx`:
- `Bash`: a command card.
- `Edit`, `MultiEdit` and `Write`: a diff card.
- `Read`, `Grep` and `Glob`: one-line rows.
- `TodoWrite`: a to-do card.

## 4. The ChatGPT desktop app for Linux, 26.1117

The app is still the Codex app under the ChatGPT brand
(`productName: "Codex"`, `codexAppBrand: "chatgpt"`).
[`visuals-in-the-chat.md`](visuals-in-the-chat.md) §4 covers how it draws (Mermaid,
`charts_widget_v2`, the `visualize` fragment, MCP Apps). This section is
the rest: the tools.

**The agent's own tools.** These live in the `codex` binary, handlers
under `core/src/tools/handlers/`:

| Tool | Drawn as | Interactive |
|---|---|---|
| `exec_command`, `shell`, `write_stdin` | An `exec` item with streamed output; reads, listings and searches fold into "Read files" and "Searched" | Approval: `item/commandExecution/requestApproval` |
| `apply_patch` | A `patch` item, a unified diff, and a `turn-diff` for the whole turn | Approval: `fileChange/requestApproval` |
| `update_plan` | A `todo-list` | |
| `request_user_input` (one to three questions) | `userInput` | Answered by the user |
| `request_permissions` (filesystem or network profiles) | `permission-request` | Granted by the user |
| `web_search`, `view_image`, `image_gen` | `web-search`, `image-view`, `generated-image` | |
| Subagents: `spawn_agent`, `send_input`, `wait_agent`, `list_agents`, `interrupt_agent`, `close_agent`, `resume_agent` | `multi-agent-action`, `subagent-activity`, a subagents panel | |
| `tool_search` (BM25 over tools loaded on demand), MCP resources, `sleep`, memories, `get_context_remaining` | A generic row | |

**The app's own tools.** These are given to the agent in the `codex_app`
namespace, and also served over MCP by a bundled plugin:
- Threads: list, read, create, send to, fork, wait on (up to eight),
  hand off, archive, pin.
- Projects and hosts.
- Worktrees: create, attach, archive, restore.
- `open_in_codex`, which opens a file, a page, a browser tab, a terminal
  or a review in a panel.
- `read_thread_terminal`.
- `automation_update`, for recurring tasks.
- Settings.
- `read_pull_request_check_diagnostics`.
- `update_running_summary`, the status pill.

Most of these run unasked. Creating, deleting, forking, handing off or
moving a thread asks first (`.mcp.json`: `default_tools_approval_mode:
"approve"`, `"prompt"` for those).

**Approvals are their own items.**
- Commands, patches, permission requests and every MCP tool can ask,
  each with copy per connector ("Allow Gmail to send an email?").
- An `automatic-approval-review` item records a verdict that a reviewer
  model gave in the user's place: approved, denied, high risk, or timed
  out.
- MCP elicitations (`mcpServer/elicitation/request`) draw a form that
  can be accepted, declined or cancelled.

**The timeline knows about 35 item types.** Beside the tools above,
several are small markers worth noting:
- `context-compaction`
- `worked-for`
- `model-changed` and `model-rerouted`
- `steered`
- `forked-from-conversation`
- `stream-error`

The reply's markdown may also carry directives the app draws as actions:
`git-stage`, `git-commit`, `git-push`, `git-create-pr` and `code-comment`.
Their exact markup is inferred, not read.

**Generative UI, beyond `visuals-in-the-chat.md`.** There is an internal
catalogue of JSON component trees, `DIL`, in `async/356413…js`: Box, Row,
Col, Card, CardCarousel, ListView, Form, Grid, Table, Markdown, Button,
Checkbox, Select, RadioGroup, DatePicker, Slider, Input, Chart, PieChart,
StockChart, Map, WeatherWidget, AudioPlayer, YouTubeEmbed and others. It
serves ChatGPT's own `genui.*` tools and is not offered to Codex or to
MCP servers.

## 5. OpenClaw

**Tools.** The list is `src/agents/core-tool-facts.ts`. Its profiles are
`minimal`, `coding`, `messaging` and `full`, about seventy tools in all.
Those that bear on a chat:

| Tool | What it is | Drawn as |
|---|---|---|
| `exec` | `command`, `workdir`, `pty`, `background`, `ask: off \| on-miss \| always`, and more | A command card with a live tail of three lines, 600 characters. Approval: an allowlist, a reviewer model, or a card (Allow once, Always, Deny) |
| `read`, `edit`, `write`, `apply_patch` | Files | A path chip; diff cards with ± counts, which prefer the diff in the result over one computed from the arguments |
| `ask_user` | One to three questions with `header`, `options` and `multiSelect`; or `requiredAction{reason, instructions, url}`; a timeout | A panel docked above the composer, one question at a time; the turn waits |
| `progress_card` | Markdown with a `<progress>` bar, and up to 50 steps (pending, in progress, completed) | A durable card beside the session; the transcript keeps a receipt |
| `show_widget` | `widget_code` (HTML or SVG, up to 10 MiB) or `report`; `pin`, `size`, `capabilities{netOrigins, tools, queries}` | A widget card that can be pinned to a dashboard, copied, or saved as PNG |
| `message` | `presentation{blocks}`: text, buttons, select, chart, table | Native to each channel; whatever a channel cannot show becomes text |
| `sessions_*`, `subagents`, `suggest_task` | Sessions and subagents | A subagents panel and task-suggestion cards |
| `screen`, `dashboard`, `terminal`, `canvas` | Drive the Control UI's panes, a dashboard, a terminal, a Mac's panel | |

**`show_widget`, the one generative path left** (`src/canvas/widget-tool.ts`):

- **Offered only when it can be drawn.** The tool appears only when the
  client declares the `inline-widgets` capability. Inline JavaScript is
  syntax-checked before hosting, and errors go back to the model with a
  line and a column.
- **`report` is typed blocks.** The blocks are `text`, `metrics`,
  `table`, `chart` (bar, line) and `links`. A report holds at most 24
  blocks in 8 KB, and no HTML.
- **HTML runs in two frames.**
  - An outer proxy on a dedicated origin, with `allow-same-origin`.
  - An inner `srcdoc` frame with `allow-scripts allow-forms` and no same
    origin (`docs/web/dashboard-architecture.md`).
  - Scripts and fonts may load from six CDN and font hosts. There is no
    `fetch` unless a pinned widget was granted `netOrigins`. Theme
    tokens arrive by `postMessage`.
- **What a widget can do back:**
  - `prompt.send` needs a click, refuses `/` commands, and is limited to
    ten a minute. It shows as the user's own message.
  - `state.emit` records a notice without starting a turn.
  - `data.read` reads bindings the gateway resolves.
  - Running actions needs a grant, and a grant is bound to the SHA-256
    of the bytes that were approved.
  - A runtime error in the widget wakes the agent to fix it.
- **MCP Apps** (`ui://`) are a second kind of content in the same cell.

**A2UI, built and dropped.**
- At `v2026.10.10` the agent wrote A2UI JSONL, in v0.8
  (`surfaceUpdate`, `dataModelUpdate`…) or v0.9 (`createSurface`,
  `updateComponents`…). It was drawn with `@a2ui/web_core` 0.12 and
  `@a2ui/lit`, on the upstream catalogue.
- Release 2026.11.5 removed it, with the hook for custom widget
  renderers (`docs/releases/2026.11.5.md`). `show_widget` with
  `kind: "a2ui"` now answers "A2UI widgets were removed; use kind html".
- The release notes were not read for a reason. What the code shows is
  the outcome: the HTML path was kept and the declarative one dropped.

## 6. What to port, and where it lands

Our two chats today, read from the code:

- **The session chat reads the agent's transcript.** Its one
  interactive part is `AskUserQuestion`. The answer goes back as
  keystrokes (`SessionChat.answer`,
  `packages/frontend/consumer/src/modules/sessions/chat/session-chat.ts:952`,
  through `questionKeys` in `packages/shared/src/sessions/question-keys.ts`).
- **A permission prompt has no card.** When Claude Code stops for one,
  the chat shows only a status line. The prompt is recognised on screen
  by phrases (`agent-activity.ts`, `ASKING`), and by the runner's
  manifest as `blocked`.
- **The bots chat has real decisions.** It has approval and question
  cards against the API, and two rich cards: the mail draft and
  `show_image`. Both travel beside the tool's text answer
  (`apps/api/src/bots-chat/application/bot-tool.factory.ts`).
- **Neither chat draws a chart, a diagram, math or HTML.**

| # | Port | From | Sessions | Bots |
|---|---|---|---|---|
| 1 | **A permission card**: what is asked (the command, or the file and its diff), with Allow once, Always, Deny, answered as keystrokes the way `AskUserQuestion` is | All three; OpenClaw's three buttons, ChatGPT's per-tool copy | The pending tool call is the last `tool_use` with no result while the screen reads `blocked`; its keys belong in the agent's screen manifest beside `questionKeys`. Codex has the same prompt | Already has one |
| 2 | **Mermaid and KaTeX** in the shared `Markdown` | ChatGPT; `visuals-in-the-chat.md` slice 1 | Both chats, no change to the agent | |
| 3 | **One block format** in `packages/shared`: `markdown`, `metrics`, `table`, `bar` / `line` / `area` / `ring` chart, `checklist`, `progress` (value against a target, or steps), `record` (labelled fields), `callout`, `links`. Limits as OpenClaw's (24 blocks, 8 KB) to start. One renderer on the design system's charts | The intersection of openbot's gallery, OpenClaw's `report`, ChatGPT's `charts_widget_v2` and Synara's blocks | `runner sessions show <spec.json>`, an `oppenheimer.visual` entry, taught by `runner --skill` (`visuals-in-the-chat.md` slice 3) | A `show_visual` tool on the mail draft's path (slice 2) |
| 4 | **A form decision**: one to eight fields (text, number, select, textarea), answered as the tool's result, one slot per call | openbot's `askForm`, ChatGPT's MCP elicitation | | Beside the approval and question cards, as a third kind of waiting a bot can do |
| 5 | **The live tail on a running command**: the last three lines while it runs, the full output once done | OpenClaw; ChatGPT's `outputDelta` | Not traced: the console has the output once the result lands in the transcript, and the screen while it runs; drawing the tail from the screen wants checking | Bots run no commands of their own |
| 6 | **Small markers**: worked for N s, model changed, compaction, steered | ChatGPT | `ChatMarker` already draws two of them | |
| 7 | **HTML in a frame**, behind a flag. The fragment goes into a fixed shell on a second origin. Theme tokens are posted to it. Its only calls out are size, an open-link request that asks first, and a prompt sent only on a click, refusing `/` commands and rate-limited | OpenClaw's two frames match `spikes/visuals-poc/` | `visuals-in-the-chat.md` slice 4 | Same |

**What not to port:**

- **A2UI and other declarative component trees.** OpenClaw built A2UI
  and removed it. ChatGPT's tree catalogue is internal. A typed block
  list (row 3) covers data, and HTML (row 7) covers the rest.
- **The CopilotKit runtime and AG-UI.** Our stream comes from a
  transcript over the runner's link. The patterns travel; the SDK would
  be a second protocol beside `design/sessions/chat-protocol.md`.
- **Hosting MCP Apps.** Not while neither our bots nor the runner attach
  outside MCP servers (`visuals-in-the-chat.md` §4.4).
- **ChatGPT's app tools as tools for a session's agent.** Threads, fork,
  hand off and wait already exist for bots as session tools. For a
  session's agent, the way in is `opp` and the MCP server
  (`design/clients/mcp-cli-and-agent.md`), not new chat UI.

Rows 1, 4 and 5 are about decisions and feedback, not visuals, and need
no new origin. Row 1 alone is not a visual change to a bot. Rows 3 and 7
are the `visuals-in-the-chat.md` plan, now with three products agreeing on
its contents.

## 7. What is not known

- **How exactly to answer a permission prompt.** Which keys answer
  Claude Code's and Codex's prompts in every version they run today
  (Allow once, Always, Deny each). The screen manifests know what the
  question looks like, not yet what the answer is. This wants a recorded
  trial per agent before row 1 is built.
- **Whether a session's agent will reach for `runner sessions show`**
  unprompted (`visuals-in-the-chat.md` §7). OpenClaw shows the tool only to
  clients that declare they can draw it. For us, that is `runner
  --skill` taught only on hosts whose console draws visuals.
- **What ChatGPT's directives look like.** Their markup (`git-commit`,
  `code-comment`…) is inferred from type strings.
- **How `show_widget` reaches Codex.** OpenClaw's bridge for it was not
  traced.

## 8. Questions for the owner

1. **Build the permission card first?** It is not generative UI, but
   all three products have it, and it is what a session's user meets
   most. The pick is yes, as a `propose` of its own.
2. **Is the block list in row 3 right?** It is what the three products
   share, plus `progress` and `record`, which only openbot has. The pick
   is to start with it and grow it only when an agent asks for a block
   it lacks.
3. **Should bots get forms?** A form lets a bot ask for several values
   at once, where today it asks questions one by one. The pick is yes,
   after row 3.
