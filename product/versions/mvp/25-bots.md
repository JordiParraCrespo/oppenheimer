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
shows in the chat. Its two documents, `SOUL.md` and `INSTRUCTIONS.md`,
keep revisions you can read and revert; a change to its profile or its
memory is an activity line saying what changed, and you undo it by hand
in Settings, not from a history.

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
  | ChatGPT | OpenAI Agents SDK | ChatGPT's Codex backend, on a ChatGPT subscription |

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
  Claude Code is the loop, compaction and web search; real work on files
  goes to a session on a host (§4.2). Its `WebFetch` and subagents are off
  too (2026-10-15): the first fetched any address it was given, the
  server's loopback and private network included, and bots used the second
  to go looking through the server's disk.
- **Keys stay in Oppenheimer.** A workspace stores one key per provider,
  encrypted (Settings → Model providers). The worker reads it for the
  turn and hands it to the engine; it is never written to a host, never
  returned by the API, and never logged.
- **ChatGPT runs on a subscription, not a key** (2026-10-15). Connect
  ChatGPT signs the workspace in the way the Codex CLI and OpenClaw do:
  OpenAI's device code flow on the Codex CLI's public client (the
  browser-redirect flow only ever lands on `localhost:1455`, which a hosted
  console cannot receive). The person types a one-time code on OpenAI's
  page; the console polls a sealed handle the API gave it, so the API keeps
  nothing while it waits. What is stored, sealed like a key, is the
  sign-in's access and refresh tokens and the account they act for. A turn
  calls `https://chatgpt.com/backend-api/codex/responses` with the account
  header, `store: false` and its reasoning sent back encrypted. The worker
  refreshes the token when a turn finds it about to lapse, one refresh per
  workspace at a time (turns on the same replica share it; one on another
  replica fails at once rather than wait), written only over the tokens it
  read; a refresh
  ChatGPT refuses removes the sign-in, and the bot answers that it has no
  key. Usage counts against the subscription's limits, not API billing.
  The route is not a published API: OpenAI may change the client, the
  headers or the path, and OpenClaw's docs are the reference for what it
  allows (they state OpenAI supports subscription sign-in in external
  tools).
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
  *Researcher*" with an Open link;
- an activity line for each change to its profile or memory ("Renamed
  itself *Scout*", "Remembered: deploys go out on Tuesdays", "Forgot a
  fact"), with the old and new value, and a link to the Settings tab
  where you change it back.

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
| `update_profile` | Change its name and description; an activity line, no revision | auto |
| `remember` | Save a fact with its source; an activity line, no revision | auto with *Learn automatically*, else ask |
| `forget` | Delete a fact; an activity line with the fact, no revision | auto |
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
| `list_projects` / `get_project` | The workspace's projects, or one with its repositories, default host and agent | auto |
| `create_project` / `update_project` | Make a project, or change its name, repositories, default host or agent | ask |
| `list_tasks` / `get_task` / `plan_summary` | Tasks, milestones, stats | auto |
| `create_task` / `update_task` / `move_task` | Add a task, edit its title, notes, milestone, due date or blocked reason, or move it to a column | auto |
| `delete_task` | Delete a task | ask |
| `start_task_session` | A session for a task | ask |

### 4.4 GitHub and pull requests
| Tool | Does | Default |
|------|------|---------|
| `list_repositories` / `list_branches` | What the connected installations cover | auto |
| `list_pull_requests` / `get_pull_request` | With files, comments and activity | auto |
| `comment_on_pull_request` / `review_pull_request` | Post a line comment, or submit a review: approve, request changes or comment | ask |
| `start_review_session` | Review it in a session | ask |
| `merge_pull_request` | Merge it, squash by default | ask |

### 4.5 Automations and calendar
| Tool | Does | Default |
|------|------|---------|
| `list_automations` / `get_automation` / `run_history` | The workspace's automations, one with its trigger and settings, and their past runs | auto |
| `create_automation` / `update_automation` / `delete_automation` | Make, change or delete an automation | ask |
| `run_automation` / `pause_automation` / `resume_automation` | Run one now, or stop and restart its triggers | ask |
| `list_events` | Events on a connected calendar | auto |
| `create_event` / `update_event` / `delete_event` | Add, change or delete an event on a connected calendar | ask |

### 4.6 Other bots
| Tool | Does | Default |
|------|------|---------|
| `list_bots` / `get_bot` | The workspace's bots and what they are for | auto |
| `ask_bot` | Give another bot a task and wait for its answer | auto |
| `message_bot` | Send another bot a message without waiting | auto |
| `create_bot` | A new bot: name, description, soul, instructions, provider, model, group | ask |

`ask_bot` runs a turn in the other bot, marked as coming from the first
one; both chats show it. A bot that creates a bot makes it **yours**,
marked "created by" the creator, with no looser permissions than its own.

Two named policies bound bots talking to bots. Both belong to the turn
queue (`bot-turns`, §8): it checks the chain before it enqueues a turn a
bot asked for, and it picks the next turn by lane. Nothing else holds
these numbers.

**`BotChainPolicy`**: a chain starts at one message of yours and
counts every turn a bot asks of another bot because of it.

| Limit | Value | Past it |
|-------|-------|---------|
| `maxDepth` | 3 bots deep | the call is refused |
| `turnBudget` | 10 bot-to-bot turns per chain | the call is refused |
| `cycles` | none: a bot already in the chain is never asked | the call is refused |

A refused call comes back to the asking bot as the tool's result, and the
bot says in its chat that it stopped and why.

**`BotQueueLanes`**: the order a bot's waiting turns run in, one turn at
a time (§2).

| Lane | Holds |
|------|-------|
| 1. `owner` | Your messages |
| 2. `bots` | Messages and `ask_bot` calls from other bots |
| 3. `background` | Delegated jobs and other work nobody waits on |

### 4.7 Work and the web
| Tool | Does | Default |
|------|------|---------|
| `delegate` | A subagent for a long job; the bot keeps talking and the result arrives as a message. Ours, not the engine's: Claude Code's subagents are off | auto |
| `web_search` | From the engine (the provider runs it) | auto |
| `web_fetch` | Ours, not the engine's: http(s) to public addresses only, refusing loopback, private and link-local ones, with a time limit | auto |
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
- **Revisions and activity:** `bot_document_revision` covers the two
  documents, `SOUL.md` and `INSTRUCTIONS.md`, and only those: they are
  what Settings reads and reverts. A self-edit of the profile (`update_profile`)
  or of memory (`remember`, `forget`) has no revision table; it is a
  `bot_message` of kind activity in the chat, carrying who changed what,
  from what to what, and it is undone by hand.
- **Worker:** a BullMQ queue `bot-turns`, processed in the API process for
  now; the same image can run it alone when turns need their own
  container. It owns `BotChainPolicy` and `BotQueueLanes` (§4.6).
- **Console:** the rail's Employees entry opens `/bots`; a bot's chat is
  `/bots/<id>`, its settings `/bots/<id>/settings/<tab>`; the provider
  keys are `/settings/model-providers`.

## Research

What a read of Grok Bot found is in
[`lessons-from-grok-bot.md`](../../research/lessons-from-grok-bot.md) §5.
The decisions it produced:

- **A curated chat** (§3): what the bot says, one activity line per run
  of tools, cards for what needs you.
- **A source on each fact** it remembers (§1, §4.1).
- **Queue lanes and a bounded chain** for bot-to-bot turns
  (`BotQueueLanes`, `BotChainPolicy`, §4.6).
- **Revisions for its documents** (§1, §8), where Grok Bot keeps none.
- **The owner's own permissions as the ceiling** (§4, §5).

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
- 2026-10-15: **a bot changes itself without asking**, by default: a
  change to SOUL.md or INSTRUCTIONS.md is a revision you can revert, and
  a change to its profile or memory is an activity line in the chat. It
  replaces 2026-10-11's "a change it proposes to
  its own soul or instructions waits for you".
- 2026-10-15: **the owner chooses the permissions**, tool by tool, within
  their own; the approval chip is a preset over them. It replaces
  2026-10-14's "*Ask for approval* comes with slice 4".
- 2026-10-15: bots **talk to each other and create bots**, within the
  limits of `BotChainPolicy` (§4.6).
- 2026-10-15: **ChatGPT is a fourth provider**, on the OpenAI engine,
  signed in with a ChatGPT subscription instead of a key (§2). It adds to
  2026-10-15's three providers rather than replacing one: OpenAI on an API
  key stays.
- 2026-10-15: **the engine's `WebFetch` and subagents are off.** Battle
  tests found `WebFetch` reaching the server's loopback with no
  private-address check, and bots sending subagents through the server's
  disk whenever they lacked a tool. `web_fetch` and `delegate` come back as
  our own tools (§4.7). It replaces the first slice's "keeps web fetch and
  subagents".
