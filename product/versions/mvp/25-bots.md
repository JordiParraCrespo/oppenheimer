# 25 — Bots: a general bot, end to end

The 2026-10-13 and 2026-10-14 exports (`design/version1/Bots.dc.html`,
`BotSettings.dc.html`, `catalog.js`) draw the **Employees** section: a
sidebar of bots in groups, a chat with each, and a settings page per bot.
This note is what gets built first: **one general bot**, one you create
blank, chat with, and shape. The owner settled the questions in
conversation on 2026-10-10 to 2026-10-15; they are under "Decided" at the
end, and the sections are written to match.

The console calls the section **Employees**; everywhere inside the
product (code, tables, routes, copy in the section) the thing is a
**bot**.

## 1. What a bot is

A bot is a worker you talk to. Who it is, what it knows and what it said
live in Oppenheimer; its loop runs in Oppenheimer too, on the model
provider you pick for it. A host is where it sends real work, not where
it lives.

| Part | Stored as | Shown as |
|------|-----------|----------|
| Who it is: name, description, avatar, sidebar group | Columns on `bot` | Settings → Profile |
| `SOUL.md`: persona and tone | A document with revisions | Settings → Instructions |
| `INSTRUCTIONS.md`: its job and rules | A document with revisions | Settings → Instructions |
| What it remembers | Rows, one fact each, with where it came from | Settings → Memory |
| Its provider, model and effort | Columns on `bot` | The chat's composer |
| What it may do, tool by tool | Rows that differ from the catalog default | Settings → Permissions |
| Where its sessions run by default | `bot.homeHostId` | Settings → Works on |
| The conversation | Turns and messages | The chat |

Postgres is the source of truth for all of it. A bot changes what it is
and what it knows only through Oppenheimer's tools (§4), and every change
is a revision you can read and revert.

## 2. Where a turn runs

A message you send is a **turn**. The API records it and queues it; a
worker runs it and streams what happens back to the chat.

- **One `BotEngine` port, two engines.** The bot's provider picks the
  engine:

  | Provider | Engine | How it reaches the model |
  |----------|--------|--------------------------|
  | Anthropic | Claude Agent SDK | Anthropic's API |
  | GLM | Claude Agent SDK | z.ai's Anthropic-compatible endpoint |
  | OpenAI | OpenAI Agents SDK | OpenAI's API |

  Both engines get the same system prompt (soul, instructions, memory),
  the same history and the same tools, and both are translated into the
  same stream of chat messages. Neither SDK's types leave the package that
  wraps them (`@oppenheimer/backend-agents`).
- **The worker owns the turn.** A BullMQ worker runs it, so closing the
  tab does not stop it and a turn is not capped by a request's timeout.
  One turn at a time per bot: a message sent while it works waits its
  turn. **Stop** cancels the running turn.
- **The Claude engine runs without a shell.** The Claude Agent SDK is
  Claude Code as a library; its shell and file tools would run commands
  the model chose on the control plane. They are off. What it keeps from
  Claude Code is the loop, compaction, web search and fetch, and
  subagents; real work on files goes to a session on a host (§4.2).
- **Keys stay in Oppenheimer.** A workspace stores one key per provider,
  encrypted (Settings → Model providers). The worker reads it for the
  turn and hands it to the engine; it is never written to a host, never
  returned by the API, and never logged.
- **Streaming.** The worker publishes the turn's progress (text as it is
  written, tool steps, the end) on a per-bot channel; the console reads it
  over Server-Sent Events while the chat is open and re-reads the stored
  messages when the turn ends. The stored messages are the record; the
  stream is only how they arrive early.

## 3. The chat

The chat shows what the bot says, not everything it does:

- the bot's text, streamed;
- one activity line per run of tool calls ("Read 2 documents, searched the
  web"), which opens to the steps;
- cards for what needs you or changed something: a **Needs input** card
  (§5), "Updated INSTRUCTIONS.md" with a link to the revision, "Created
  *Researcher*" with an Open link.

## 4. The tools

Every tool is a thin wrapper over a command or query the API already
has, run as **the bot's owner**: a bot can never do more than the person
who owns it may do, the rule that already governs API tokens. Tools are
defined once, as an in-process MCP server both engines use.

**Default** is the catalog's: *auto* runs, *ask* shows a Needs input card,
*never* is not given to a bot at all. The owner changes any of them (§5).

### 4.1 Itself
| Tool | Does | Default |
|------|------|---------|
| `get_self` | Its profile, soul, instructions and settings | auto |
| `edit_soul` | Rewrite SOUL.md, saved as a revision | auto |
| `edit_instructions` | Rewrite INSTRUCTIONS.md, saved as a revision | auto |
| `update_profile` | Its name and description | auto |
| `remember` | Save a fact with its source | auto with *Learn automatically*, else ask |
| `forget` | Delete a fact | auto |
| `recall` | Search its memory | auto |

### 4.2 Sessions: its hands on hosts
| Tool | Does | Default |
|------|------|---------|
| `list_hosts` | Hosts, online or not, and the agents they can run | auto |
| `list_sessions` / `get_session` | Sessions and their state | auto |
| `start_session` | Start an agent on a host, in a new worktree or a folder, with a task | ask |
| `send_to_session` | Type a message into a running session | ask |
| `read_session` | A session's recent output | auto |
| `stop_session` / `close_session` | Stop it, or close and clean up | ask |
| `list_folders` | Browse a host's folders | auto |

### 4.3 Projects and the plan
| Tool | Does | Default |
|------|------|---------|
| `list_projects` / `get_project` | | auto |
| `create_project` / `update_project` | | ask |
| `list_tasks` / `get_task` / `plan_summary` | Tasks, milestones, stats | auto |
| `create_task` / `update_task` / `move_task` | | auto |
| `delete_task` | | ask |
| `start_task_session` | A session for a task | ask |

### 4.4 GitHub and pull requests
| Tool | Does | Default |
|------|------|---------|
| `list_repositories` / `list_branches` | What the connected installations cover | auto |
| `list_pull_requests` / `get_pull_request` | With files, comments and activity | auto |
| `comment_on_pull_request` / `review_pull_request` | | ask |
| `start_review_session` | Review it in a session | ask |
| `merge_pull_request` | | ask |

### 4.5 Automations and calendar
| Tool | Does | Default |
|------|------|---------|
| `list_automations` / `get_automation` / `run_history` | | auto |
| `create_automation` / `update_automation` / `delete_automation` | | ask |
| `run_automation` / `pause_automation` / `resume_automation` | | ask |
| `list_events` | When a calendar is connected | auto |
| `create_event` / `update_event` / `delete_event` | | ask |

### 4.6 Other bots
| Tool | Does | Default |
|------|------|---------|
| `list_bots` / `get_bot` | The workspace's bots and what they are for | auto |
| `ask_bot` | Give another bot a task and wait for its answer | auto |
| `message_bot` | Send another bot a message without waiting | auto |
| `create_bot` | A new bot: name, description, soul, instructions, provider, model, group | ask |

`ask_bot` runs a turn in the other bot, marked as coming from the first
one; both chats show it. In a bot's queue your messages come before
messages from bots, which come before background work. A chain of bots
stops at three deep, at ten bot-to-bot turns after one message of yours,
and never asks a bot already in the chain; the bot then says it stopped.
A bot that creates a bot makes it **yours**, marked "created by" the
creator, with no looser permissions than its own.

### 4.7 Work and the web
| Tool | Does | Default |
|------|------|---------|
| `delegate` | A subagent for a long job; the bot keeps talking and the result arrives as a message | auto |
| `web_search` / `web_fetch` | From the engine | auto |
| `ask_user` | A question card with options | auto |

### 4.8 Never given to a bot
Pairing, unpairing or uninstalling hosts; connecting or disconnecting
GitHub and calendars; members, roles, API tokens, admin, feature flags;
sharing sessions; deleting bots.

## 5. Permissions

The owner chooses what each bot may do. **Settings → Permissions** lists
the tools of §4 grouped as there, each **Allow**, **Ask** or **Off**:

- **Allow** runs without asking.
- **Ask** stops the turn on a **Needs input** card: Approve once, Always
  allow, Deny, or tell it what to do instead. *Always allow* sets the tool
  to Allow.
- **Off** removes the tool; the model never sees it.

The composer's approval chip is a preset over the list: **Ask for
approval** (the catalog's defaults), **Approve for me** (everything inside
Oppenheimer allowed, what reaches outside it asks: merging, commenting,
calendar, creating bots, sessions), **Full access** (everything allowed).
A tool changed by hand makes the chip read **Custom**. Only the rows that
differ from the catalog are stored, so a tool added later reaches every
bot with its default. No setting lets a bot exceed its owner's own
permissions, and §4.8 is never on the list.

## 6. What is built, in slices

Each slice is a stacked pull request, green on `pnpm ci:local`, checked on
the local stack, with screenshots where the console changes.

1. **The bot without a runtime.** Tables and endpoints; the Employees
   section; Settings → Profile, Instructions (revisions, revert), Memory,
   Runs on; delete.
2. **The chat.**
   - *Model providers:* a workspace's encrypted keys, and a bot's
     provider, model and effort.
   - *The engines:* `@oppenheimer/backend-agents` with the port, both
     adapters and a fake for tests.
   - *Turns:* `bot_turn` and `bot_message`, the worker, Stop, the stream,
     and the chat that draws it.
3. **It shapes itself.** The tools of §4.1, the permissions of §5 and
   the Needs input card. Settings → Runs on becomes **Works on**.
4. **It works with others.** §4.2 to §4.7: sessions, the plan, pull
   requests, automations, calendar, other bots, subagents.

## 7. Not built yet

Templates (GitHub, Sessions, Plan, and Blank as a template), the built-in
bots (Project manager, Merge manager), group chats with several bots,
Routines, Notifications, plain-language permission rules ("always ask
before touching the payments repo"), daily caps, slash commands, voice,
attachments, the context meter, project and user memory, a bot's engine
running on a host of its own with the full Claude Code toolset.

The design's avatar photos are photographs of people; until there is a
set we may use, an avatar is the bot's initials on one of the design's
eight colours (`AV_COLORS`).

## 8. Where things live

- **API:** the `bots` module. `bot`, `bot_group`, `bot_document`,
  `bot_document_revision` (append-only, author you or the bot),
  `bot_memory_fact`; from slice 2 `model_provider_credential`, `bot_turn`
  and `bot_message`; from slice 3 `bot_tool_permission` and
  `bot_approval`. Workspace-scoped like automations, with the `Bot`
  policy subject and the `bots:read` / `bots:write` scopes.
- **Engines:** `packages/backend/agents` (`@oppenheimer/backend-agents`),
  the only code that imports either SDK.
- **Worker:** a BullMQ queue `bot-turns`, processed in the API process for
  now; the same image can run it alone when turns need their own
  container.
- **Console:** the rail's Employees entry opens `/bots`; a bot's chat is
  `/bots/<id>`, its settings `/bots/<id>/settings/<tab>`; the provider
  keys are `/settings/model-providers`.

## Research

`product/research/lessons-from-grok-bot.md` read Grok Bot 0.18's
connection layer. On 2026-10-15 a static read of Grok Bot 0.71.2 (built by
Anysphere on Cursor's agent stack) found the loop moved to the vendor's
servers, a curated chat where only what the bot sends reaches you, memory
as files with a source on each fact, layered approvals, and bots that
edit themselves without asking. We take the curated chat, the source on
each fact, queue lanes and caps on bot-to-bot turns; we keep revisions
for every self-edit and the owner's own permissions as the ceiling.

## Decided

- 2026-10-14: the first bot built is a **general** one: created blank,
  shaped by chat and settings. No templates and no built-in bots yet.
- 2026-10-14: inside the product it is a **bot**; the nav keeps
  **Employees**.
- 2026-10-11: bots' documents and memory live in Postgres.
- 2026-10-14: no photos of people as avatars; initials on a colour.
- 2026-10-15: **the loop runs in Oppenheimer**, not on a host. It
  replaces 2026-10-14's "a headless turn on the home host"; the home host
  becomes where the bot's sessions run.
- 2026-10-15: **the engines are the Claude Agent SDK and the OpenAI Agents
  SDK**, behind one port, chosen by the bot's provider: Anthropic, GLM,
  OpenAI. Their tooling (compaction, subagents, web tools, approvals) is
  why, over a loop of our own.
- 2026-10-15: **a bot changes itself without asking**, by default: every
  change is a revision. It replaces 2026-10-11's "a change it proposes to
  its own soul or instructions waits for you".
- 2026-10-15: **the owner chooses the permissions**, tool by tool, within
  their own; the approval chip is a preset over them. It replaces
  2026-10-14's "*Ask for approval* comes with slice 4".
- 2026-10-15: bots **talk to each other and create bots**, within the
  loop limits of §4.6.
