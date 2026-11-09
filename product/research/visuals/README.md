# Visuals in the chat: charts and more, for sessions and bots

Research, 2026-11-09. It decides nothing. The owner asked that bots be
able to reach visualization tools, "charts and more", and for a read of
how Synara does it, a reverse engineering of the ChatGPT desktop app for
Linux, and a plan for sessions and bots. Paths in backticks that start
with `versions/`, `next-steps/` or `research/` are relative to `product/`;
the others are relative to the repository, or to the source named beside
them.

## 1. The answer in short

Both products do the same three things, and we do none of them yet.

1. **Markdown that draws.** A `mermaid` fence becomes a diagram and
   `$…$` becomes math. The agent needs no tool for it.
2. **A chart from data.** The agent sends a small JSON description (a bar
   chart, a line chart, stats, a table) and the app draws it with its own
   components, in its own colours, in light and dark. No agent code runs.
3. **HTML the agent wrote, in a locked frame.** For what a description
   cannot say (a simulation, a map, a custom diagram, a calculator), the
   agent writes a fragment of HTML and the app runs it in a frame on
   another origin with the network closed.

Each has a fallback order: a table when a table is asked for, Mermaid when
boxes and arrows say it all, a chart from data when the data is the point,
HTML last.

For us the three land on seams that already exist. The design system has
hand-built charts with `--chart-*` tokens; the bot's tools already carry a
card to the chat beside their text (the mail draft); a session's agent
already puts a file in the chat with `runner sessions send-file`; and the
console's CSP already confines a frame to the preview domain. The proposed
order is §6: Mermaid and math first, charts from data for bots second and
for sessions third, the HTML frame last and behind a flag.

One piece was tested, because the rest of the plan leans on it: whether
the **browser** console can run agent HTML safely. Synara says no and
keeps HTML to its desktop app. It can, with a static page on a second
origin (§5).

## 2. What was read

| Source | How it was read | Standing |
|--------|-----------------|----------|
| Synara, `Emanuele-web04/synara` at `2864c3b` (2026-11-09) | The source, in full for this feature; nothing was run | Read directly |
| ChatGPT desktop app for Linux, `chatgpt` 26.1103.60933, `chatgpt_amd64.deb` from `persistent.oaistatic.com` (562,492,766 bytes, sha256 `0746e9ba…65aee71`, dated 2026-11-08) | Unpacked statically: the Debian package, `app.asar` (about 9,400 JavaScript chunks), the bundled plugins. The app was never started | Read directly; minified code, so a claim about it is a string or a snippet found, not a traced execution |
| OpenAI's public source: `openai/codex` at `9f04d88`, `openai/plugins` at `d420d13`, `openai/mcp-extensions` at `39f91ad`, `modelcontextprotocol/ext-apps` at `19256f5` | The files named in §4 | Read directly |
| The remote sandbox page the app loads for a widget (`mcp-app.html` on `*.web-sandbox.oaiusercontent.com`) | Not read: it is not in the package | Unknown; §4.3 says what follows from it |
| This repository | The runner's transcript adapters, the link protocol, both chats, the bot engine and its tools, the design system's charts, the console's CSP | Read directly |
| The frame isolation in §5 | `poc/frame-isolation.mjs`, run in Chromium (Playwright build 1243) | Measured, in one browser |

## 3. Synara

One tool, `synara_show_visual`, on the MCP server Synara already injects
into every agent it drives (Claude through the Agent SDK's `mcpServers`,
Codex through `mcp_servers`). The paths below are in its repository.

**How the model learns of it.** Almost entirely from the tool's
description, about thirty lines (`apps/server/src/agentGateway/inlineVisualTools.ts:39-68`):

> Show a finished visual - stats, a chart, a table, a comparison, a
> checklist, a small calculator, or follow-up choices - inside your reply,
> as part of the answer. Use it only when a visual reads faster than text.

Codex also gets one line in its instructions; Claude gets none and relies
on the description (`harnessPolicy.ts:57-61`, `ClaudeAdapter.ts:1595-1599`).

**What the model sends.** A title and exactly one of two things:

- `blocks`: up to 16 typed blocks in 64 KiB. The types are `markdown`,
  `stats`, `bar-chart`, `line-chart`, `table`, `list`, `callout`,
  `compare`, `calculator`, `choices` and `tabs`. A bar chart holds up to
  40 items, a line chart 6 series of 200 points, a table 10 columns by
  200 rows. A bad spec is answered with the path of the block at fault,
  so the model can correct it.
- `html`: one self-contained document of up to 256 KiB, "only for what
  blocks cannot draw, such as a diagram, a map, or a custom interactive
  view".

At most six visuals a turn.

**Where it shows.** The tool answers with a three-line fenced block,
` ```synara-visual ` and an id, and tells the model to write that block
in its reply where the visual belongs. One it does not place shows above
the reply. The id is a hash of the content, so a retried call does not
draw twice.

**How it is drawn.**

- Blocks are React components with **no chart library**: bars are `div`s
  with a width, the line chart is a hand-written `<svg>` with a hover
  crosshair. Tables sort on a click and fold after ten rows. A click on a
  `choices` option sends it as the user's next message. Five series
  colours per theme.
- HTML runs in `<iframe srcdoc sandbox="allow-scripts allow-forms">`,
  with no `allow-same-origin`. Synara puts a CSP `<meta>`, a theme
  stylesheet and a bootstrap script ahead of the agent's first byte. The
  CSP closes the network entirely: `default-src 'none'`, `connect-src
  'none'`, images only from `data:` and `blob:`, no CDN. The bootstrap
  reports the frame's height and passes link clicks to the host. Theme
  changes are posted to the frame, which does not reload.
- **HTML is desktop only.** In a browser the frame shows "HTML visuals
  are available in Synara desktop". The reason given in the code is that
  only Electron can stop a frame from navigating itself away
  (`apps/desktop/src/subframeNavigationGuard.ts`).

**Where it is kept.** The source goes to a file beside the thread's
attachments, the event log records only `{visualId, format, title,
height, byteLength, sha256}`, and the client fetches the source over its
authenticated WebSocket. The HTTP route refuses the directory: "Agent-authored
visual HTML must never load from the app origin".

**What it does not have.** No Mermaid, no chart library, no side panel or
versions, no image or CSV export, no streaming of a visual while it is
written, and no rendering of other MCP servers' interfaces. Its frame
messages borrow the names of the MCP Apps standard
(`ui/notifications/size-changed`, `ui/open-link`) without implementing it.

## 4. The ChatGPT desktop app for Linux

The app is `openai-codex-electron`, product name "Codex", on Chromium
157 with Node 24.22.1. The interface is shipped in the package, not
loaded from chatgpt.com. It carries a `codex` binary, and seven bundled
plugins, one of which is `visualize` 1.0.84. Paths below are inside the
package unless a repository is named.

It has four ways to show something, not one.

| | The model writes | The app draws it with | Agent code runs |
|---|---|---|---|
| Markdown | A `mermaid` fence, `$…$`, a pipe table | Mermaid 11.16.0 (`securityLevel: "strict"`), KaTeX 0.16.45, Shiki, all loaded on first use | No |
| Chart from data | A `genui` reference holding a `charts_widget_v2` JSON object | Recharts | No |
| Visualization | An HTML fragment in a file, and a `visualize` reference to its path | A sandboxed web view on another origin | Yes, confined |
| MCP App | A tool call whose tool names a `ui://` page | The same sandbox | Yes, the server's code |

### 4.1 References, not tool calls

Three of the four are text the model writes in its reply, between three
private-use characters: U+E200 opens, U+E202 separates the name from a
JSON payload, U+E201 closes. The client matches them with patterns of
the form `genui([\s\S]+)` and `visualize([^]+)` set between those
characters. The visual appears where the reference stands, which is what
Synara's fenced pointer is for.

`openai/codex` still documents an older form, a line
`::codex-inline-vis{file="chart.html"}`. The shipped skill no longer
teaches it: the model writes the reference and the client rewrites it
into that directive.

### 4.2 The chart from data

The specification is public, in `openai/plugins`
(`plugins/data-analytics/skills/visualize-data/references/native-inline-visualizations.md`):
one chart, of type `bar`, `line`, `pie` or `scatter`, with `meta {title,
description, footer}`, an `xKey`, `series[] {dataKey, label, valueFormat,
valuePrefix, valueSuffix}` and the rows last. Its rule for the model:

> Let the host renderer own the card, spacing, axes, grid, tooltip,
> legend, colors, hover states, responsive layout, compact formatting,
> and dark mode.

In the app, the reference becomes a `client_defined_widget` with
`language: "recharts-json"`, drawn by a lazily loaded `ChartWidget`. The
card offers "View as table", "Copy table" and "Download as image".

### 4.3 The visualization

**How the model learns of it.** A skill of 316 lines with twenty
reference files it reads on demand (one per chart family, maps, mockups,
four widgets). Its description makes the model reach for it unasked:
"Proactively use to show how something works". Its first rules are when
*not* to:

> Use a normal Markdown table when the user asks for a table; return it
> directly and do not create a visualization file.
>
> Use Mermaid when labeled nodes and edges fully explain a static
> structure … Use HTML for dynamics, spatial motion, adjustable inputs,
> and other visuals.

**What the model writes.** A fragment, not a document ("no
`<!doctype>`, `<html>`, `<head>`, or `<body>`"), under 1 MB, saved as a
file on the machine the agent runs on. Then the reference with the
file's absolute path, and optionally `"mode":"wide"`.

**What the fragment may use.** The opposite choice from Synara on the
network: scripts and styles may load from seven public CDNs (cdnjs,
jsDelivr, esm.sh, unpkg, Google Fonts, Bunny Fonts) and from OpenAI's
own pinned chart runtime at `persistent.oaistatic.com/plugins/visualize/charts/1.1.6`,
which draws thirteen chart families. Data may not be fetched: "Never use
`fetch`, XHR, WebSocket, or other API calls", and the frame's connections
are limited to `blob:` and `data:`. The skill gives the model a contract
of CSS variables (`--background`, `--foreground`, `--card`, `--primary`,
`--muted`, `--border`, `--viz-series-1..6`, six named colours) and
Bootstrap-like classes (`.card`, `.btn`, `.table`, `.form-range`,
`.viz-stat`, `.viz-grid`), so a fragment matches the app without styling
itself.

**How it is confined.** Not `srcdoc`. The app opens an Electron
`<webview>`, in its own session partition, on a host of the form
`codex-inline-visualization-<hash>.web-sandbox.oaiusercontent.com`, with
Node integration off and context isolation on. Downloads are cancelled
and permissions denied. The page on that origin is a shell fetched from
OpenAI, and the app hands it the fragment over a message channel. That
shell is the part not read, so the frame's final CSP and the flags of
any inner frame are not known.

**What the frame can ask of the app.** A small set of calls:
`notifyIntrinsicHeight`, `openExternal` (behind a dialog, "Open external
link?"), `requestDisplayMode` (inline or fullscreen),
`sendFollowUpMessage` and `updateWidgetState`. The last two are what
make a visual a tool and not a picture: a control in it can send the
model a message, and can keep up to 16 KiB of state of which only a
marked part reaches the model.

**Around the frame.** "Loading visualization" while it starts, with a
30-second limit. On a failure, "An error occurred inside the
visualization" with Reload and "Ask ChatGPT to fix it", which sends the
error back to the model. Controls to copy, copy as image, expand and
publish as a site. While a fragment streams, its scripts are stripped
and run only on the last update.

### 4.4 MCP Apps

A tool's descriptor names a page, `_meta.ui.resourceUri` (or the older
`openai/outputTemplate`), with the type `text/html;profile=mcp-app`. The
app fetches the page from the MCP server and runs it in the same sandbox,
speaking the open standard's messages (`ui/initialize`,
`ui/notifications/tool-input`, `ui/notifications/tool-result`,
`ui/message`, `ui/open-link`). OpenAI's own data plugin draws its charts
this way, with Recharts 3.8 inside the page. This is how a third party's
tool brings its own interface, and it is a different question from ours:
our bots attach no outside MCP server
(`packages/backend/agents/src/claude/claude-options.ts:214-227`).

### 4.5 What was looked for and not found

Canvas, as a client renderer (`canmore` is only detected), and
interactive charts from the Python tool (its charts arrive as images).
Sorting or CSV export on a markdown table. The Recharts and Electron
versions.

## 5. Agent HTML in a browser, tested

Synara's reason for keeping HTML to its desktop app, and ChatGPT's use of
a web view, raise the question for a console that is a web page. Two
facts of ours decide it, and both were checked in
[`poc/frame-isolation.mjs`](poc/frame-isolation.mjs), which serves a
"console" with the CSP of `apps/web/nginx.conf`, a static shell on a
second origin, and a third origin that nothing should reach.

| Question | Result |
|---|---|
| Does a `srcdoc` frame work in our console? | No. It inherits the console's `script-src 'self'`, and its script does not run. Synara's design cannot be copied as it is |
| Does a shell page on a second origin, in `sandbox="allow-scripts"`, run a fragment the console posts to it? | Yes, and it reports its height back |
| Can the fragment fetch from another origin, or load an image from one? | No: the shell's own CSP refuses it. No request left the frame |
| Can it read the console's page, `localStorage` or a cookie? | No: without `allow-same-origin` the frame has an origin of its own |
| Can it open a window, or navigate the console away? | No |
| Can it navigate itself to another site, which is what Synara needs Electron to stop? | No. The console's existing `frame-src`, which names only the preview domain, refuses the navigation. No request left |

So the shape that works for us is ChatGPT's, in a browser: **one static
page on a separate origin, which the console frames and posts the
fragment to.** The API never serves the agent's bytes from its own
origin, the page is the same for every visual, and each frame gets an
origin of its own from the sandbox. Deployments with a preview domain
already have the second origin and the `frame-src` entry
(`versions/mvp/30-session-previews.md`).

The test ran in one Chromium build. Firefox and Safari are not measured.

## 6. A plan

What exists today, read from the code:

- **Neither chat draws a diagram, a chart, math, SVG or HTML.** The
  shared `Markdown` (`packages/frontend/web/src/markdown/components/markdown.tsx`)
  is built on `marked`, with highlight.js for code. Mermaid and KaTeX are
  item 9 of "Where a better display would pay next" in
  `next-steps/0.7-terminal-and-chat.md`, proposed and not built.
- **The design system has the charts**, hand-built as Synara's are:
  `AreaChart`, `BarChart`, `BarList`, `LineChart`, `RingChart`,
  `StatCard`, on `--chart-1..5` in light and dark
  (`packages/frontend/design-system/web/src/components/charts.tsx`). The
  UI catalog says to use them and not a chart library.
- **A bot's tool can already put a card in the chat.** A tool's answer to
  the model is text; beside it travels a side channel the model never
  reads, which is how `show_image` and the mail draft card work
  (`apps/api/src/bots-chat/application/bot-tool.factory.ts:575`).
- **A session's agent is not ours to give tools to**: it is Claude Code
  or Codex in tmux, and the runner attaches no MCP server. What it has is
  `runner sessions send-file`, taught by `runner --skill`, which writes
  an `oppenheimer.file` entry the chat draws as a card. An SVG sent that
  way shows as its source text today.
- **Telegram and WhatsApp send text only.**

One visual format for both chats, in `packages/shared`: a title and a
list of typed blocks, as Synara's `blocks`. One renderer for it in
`packages/frontend/web`, on the design system's charts. Bots and sessions
differ only in how the visual reaches the chat.

| Slice | What it adds | Sessions | Bots |
|---|---|---|---|
| 1. Markdown that draws | A `mermaid` fence drawn (strict mode, loaded on first use, source shown when it does not parse) and KaTeX for math, in the shared `Markdown`. An SVG sent with `send-file` shown as a picture, through `<img>`, where a script in it cannot run | Both at once, no agent change: Claude Code and Codex already write Mermaid fences | The same component; one line in the prompt |
| 2. Charts from data, for bots | The block format, its renderer, and a `show_visual` tool: stats, bar, line, area, ring, table, compare, callout. Limits from Synara as a start (16 blocks, six a turn). A bad spec is answered with the block at fault | | The mail draft's path: a field on the tool's answer, on the stored step, on the DTO, and a card in `BotActivity`. On Telegram and WhatsApp, the title and the data as text |
| 3. Charts from data, for sessions | `runner sessions show <spec.json>`, an `oppenheimer.visual` transcript entry, a `visual` block in `chat-blocks.ts`, and a section in `runner --skill` | The spec travels inside the entry (it must stay under the 64 KiB an entry may be), so it is in the history with no second fetch | |
| 4. HTML in a frame | The shell page on its own origin, the frame, and `html` accepted by the tool and the command. Theme variables and a small stylesheet given to the fragment. Height, open link (asked first) and send a message as the only calls out | The fragment stays on the host and is fetched over the link, as a shared file's preview is | The fragment goes to bot storage, read only by the console and never served as a page |
| Later | Placing a visual inside the reply; a picture of it for Telegram and WhatsApp once channels send photos; copy as image and view as table; `structuredContent` for `opp` and the MCP server; hosting MCP Apps if bots ever attach outside servers | | |

Slices 1 to 3 run no agent code and need no new origin. Slice 4 is the
only one with a security surface, and the only one that needs a preview
domain or an origin like it; without one, a deployment has slices 1 to 3.
A new flag would cover 2 to 4 (`feature-flags.md`).

Three choices where the two products differ, with a pick for each:

| Choice | Synara | ChatGPT | Pick |
|---|---|---|---|
| A chart library | None, hand-built | Recharts for data charts, its own runtime inside fragments | None. Our design system already made Synara's choice, and the kinds it lacks (scatter, pie as a ring) are small |
| The network inside a fragment | Closed | Seven CDNs for scripts, no data | Closed. A CDN request tells a third party when a visual is opened, and a self-hosted deployment may have no way out |
| How a visual is placed | A fenced pointer in the reply | A reference in the reply | A card where the tool was called, first. Placement in the reply is one more thing for the model to get wrong, and both products needed a fallback for when it does |

## 7. What is not known

- Whether Claude Code and Codex, told by `runner --skill` alone, reach
  for `runner sessions show` at the right moments. Synara gives Claude no
  prompt line and relies on a tool description, which a session's agent
  will not have. This wants a recorded trial before slice 3 is built.
- Whether the frame holds in Firefox and Safari (§5).
- What ChatGPT's remote shell does inside its sandbox (§4.3).
- How a visual should read on a phone, where the chat is narrow. ChatGPT
  designs for 736 px and supports 320 px; ours was not drawn.

## 8. Questions for the owner

1. **Is slice 4 wanted at all?** Charts from data cover "charts"; HTML
   covers "and more" and carries all of the risk. The pick is to build
   1 to 3 and decide on 4 with them in hand.
2. **May a bot draw unasked?** ChatGPT's skill says to do so
   proactively; Synara's says "only when a visual reads faster than
   text". The pick is Synara's wording.
3. **What does a click inside a visual do?** Both products let a control
   send the agent a message. The pick is to fill the composer and let the
   reader send it, since a bot's turn can act on hosts.
4. **Which comes first for sessions, slice 1 or slice 3?** Slice 1 is
   free for the agent and is already written down in 0.7. The pick is
   slice 1, and slice 3 only after the trial in §7.
