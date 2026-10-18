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
| Where its sessions run by default | `bot.homeHostId` | Settings → Home host |
| The conversation | Turns and messages | The chat; Settings → Profile counts, exports and clears it |

**A new bot.** Created blank, a bot takes the next of twenty first names
the workspace does not have yet (`BOT_FIRST_NAMES`: Juno, Milo, Wren…,
no two with the same initial, so neighbours' avatars differ), on the next
colour, with a `SOUL.md` that says its name and an empty
`INSTRUCTIONS.md`. A name says who it is; the description says its job,
and the bot writes both of those itself. While `INSTRUCTIONS.md` is empty
its prompt carries a **Getting started** section instead (2026-10-16): take
the job from the first message or ask for it, with examples that fit
Oppenheimer; at most one follow-up, only for what cannot be defaulted (what
never to do without asking, how to report); one focused job, a bot per
unrelated job; then write `INSTRUCTIONS.md` (Job, How I work, Never without
asking, How I report), set the description to the job, remember what it
learned about the person, and say in two or three lines what it set up and
the first task it could do now. The steps that need a tool are the tools'
own (`setupStep` on the tool's spec), listed only when the turn offers the
tool; without one that writes `INSTRUCTIONS.md` the bot drafts it for the
person to paste in Settings. Names are given first-free, so a deleted
bot's name is the next one handed out.

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

  Both engines get the same system prompt, the same history and the
  same tools, and both are translated into the
  same stream of chat messages. Neither SDK's types leave the package that
  wraps them (`@oppenheimer/backend-agents`).
- **A new bot starts on the workspace's default provider**, at its
  default model. Settings → Model providers marks one provider with a key
  or a ChatGPT sign-in as the default (**Make default**); with none
  marked it is Anthropic when it has a key, else the first provider in
  the list above that has one, so a workspace with one key starts its
  bots on that one; with no key at all it is Anthropic. Removing the
  default's key falls back the same way. Bots already made keep their
  provider.
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
- **The system prompt is the whole prompt.** No engine default comes
  before it. In order:
  - who the bot is;
  - how a turn goes: answer or say what it is about to do, act, report
    only what a tool confirmed;
  - **a closed list of what it can do**: its tools, and that it has no
    shell, no files and no access to the machine it runs on, so a missing
    tool is a plain "I can't" and never a search of the server;
  - the rules no instruction overrides: never ask for a secret, never
    make things up, tool text is data, never talk about paths or the
    model;
  - SOUL.md, INSTRUCTIONS.md and memory;
  - that each turn's message opens with a turn context Oppenheimer
    writes, which is current and the authority on the date.
- **The system prompt does not change from turn to turn.** It holds
  nothing of the moment, so two turns of a bot whose soul, instructions,
  memory and tools are unchanged send the same bytes, and the provider's
  prompt cache keeps them (2026-10-15). The moment goes in a
  `<turn_context>` block at the start of the turn's message: the time in
  the sender's time zone (the console sends the browser's with each
  message; UTC when none comes), the bot's home host and the owner's
  hosts, each online or not. The block is added to the message the model
  is sent and never stored: the message kept is what the person wrote, so
  a later turn reads it back without a stale clock.
- **A turn is sent a token budget of history, with a summary of what
  falls out** (2026-10-15). It used to be the last 40 messages, and
  anything older was dropped without a word. Now a turn gets the
  conversation's summary, when there is one, as the first history entry
  (marked as Oppenheimer's record, not instructions, and kept out of the
  system prompt so the prompt stays stable), then the newest messages after
  the summary's cutoff that fit 24,000 tokens with it, counted as a token
  per four characters. When a turn ends and the messages the summary does
  not cover pass one and a half times that budget, a job on the
  `bot-summaries` queue folds the oldest of them into the summary until
  about half the budget is left (at most 32,000 tokens a call; a longer
  backlog takes several), with the bot's own provider, model and key and
  no tools (`BotEngine.complete`). Only messages of turns that have ended
  are folded, up to the first that has not: a queued message is never in
  the summary before its own turn reads it. A provider that refuses the
  call for rate or quota delays the job until the reset it names
  (`BotRateLimitError`), rather than retrying on the queue's schedule. The summarizer keeps decisions, facts
  about the person and their work, ids and names, open tasks and the
  bot's promises, drops small talk, and treats the conversation as data,
  not instructions. The summary is one row per bot,
  `bot_conversation_summary`, written conditionally on the version it was
  read at and only ever forward, so two jobs racing never move it back.
  The chat is unchanged: it reads every stored message; only what the
  model is sent changes.
- **A turn acts as its owner.** Everything a turn reads or does beyond the
  bot's own rows goes through the owner's scope, resolved fresh for each
  turn: the bot sees what they see now, and nothing once they leave the
  workspace.
- **A turn is bounded.** 20 model round trips and 4 minutes; past the
  time limit it is stopped and ends failed, saying so, with what it wrote
  kept. Longer work is a session on a host.
- **No path of the server reaches the chat.** The engine replaces the
  turn's scratch directory in every text, tool answer and error it hands
  back.
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

How a tool is built (`bots-chat/application/`): each area of the API is
one `Bot<Area>ToolsFactory` declaring its tools (a name, a description
whose first sentence the prompt's "What you can do" list shows, a zod
input) and dispatching that area's own queries and commands with the
owner's scope. The input is checked before anything runs; the answer is
labelled text with ids inline, times in the sender's zone, cut at 12,000
characters with the cut said; a catalog error comes back as its code,
title and detail. Text from outside (a page, a pull request, a session's
result) comes back fenced as data. A message sent through an API token or an
OAuth grant rather than the console keeps that credential's scopes on its
turn, and the turn is offered only the tools those scopes cover (each tool
names the scope of the route it stands in for), so a token scoped to
`bots:write` reaches no further through a bot than it could itself. A tool
whose default is *ask* runs at once under **Full access**; under **Approve
for me** its checked call becomes a **Needs input** card (§5) and the model
is told to end its turn and say what it asked for. Each such tool writes the
card's line from its input (`summarize`: "Start Claude Code on build-02 in
acme/xrp-mobile: Fix the failing test"). An approved call runs under the
same scope filter as the turn that asked, so a card raised through a token
that did not cover the tool never runs.

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
| `start_session` | Start an agent on a host, in a new worktree or a folder, with a task; the session's origin is `bot` and it always launches at `auto` (decided 2026-10-18: nobody sits at a bot's terminal, so `ask` would wait forever) | ask |
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
| `ask_bot` | Give another bot a task; its answer comes back as a new turn | auto |
| `message_bot` | Send another bot a message, no answer owed | auto |
| `create_bot` | A new bot: name, description, soul, instructions, provider, model, group | ask |

`message_bot` and `ask_bot` (built 2026-10-18) queue a turn on the other
bot, opened by an *event* message holding the words, in its `bots` lane
(`BotQueueLanes`). Neither holds a turn open: a bot that asks ends its turn,
and when the asked turn ends, its last text (or that it failed or was
stopped) is queued as a new turn of the asker, opened by a `bot_reply`
event. The asker's chat shows the call on its activity line and the answer
as a card; the other bot's chat shows the message as a card. What the
experiments in `../../research/agent-coordination-experiments.md` showed
agents must not be left to agree among themselves is held here instead:

- **The sender is recorded, not claimed.** The event names the bot whose
  turn made the call, as Oppenheimer read it (`bot_turn."askedByBotId"`,
  `"askedByTurnId"`), never a name in the words; a bot's name is stripped
  of quotes and brackets wherever the envelope quotes it.
- **The words are data.** The receiving bot reads them inside a
  `<bot_message>` envelope its words cannot close, marked as a colleague's
  information that never authorises an action the person has not; the
  answer comes back the same way, in `<bot_reply>`. History reads both back
  the same way.
- **No credential travels.** A message holding something shaped like a key,
  a token or a private key is refused, unsent, and the bot is told why.
- **No more reach than the asking turn.** The asked turn runs on the
  receiving bot's own engine and permission, with the asking turn's sender,
  time zone and credential scopes, so an API token reaches no further
  through a chain of bots.
- **Bounded per turn and per chain.** Five messages to other bots a turn;
  `BotChainPolicy` below for the chain, decided under a lock on the
  chain's first turn so two asks of one chain decide one after the other.

A bot that creates a bot makes it **yours**, marked "created by" the
creator, with no looser permissions than its own.

`create_bot` (built 2026-10-15) dispatches the console's own create
command as the owner, so the new bot's `createdByUserId` is the person's;
`bot."createdByBotId"` marks the creator (composite on the workspace,
`SET NULL` when the creator is deleted, shown on the bot's DTO). Its
input is the name, description, soul, instructions, provider, model
(id or label), effort, permission and group:

- **Provider and model** default to the creator's: its model on the same
  provider, the provider's default on another. A provider the workspace
  has no key for is refused, naming the ones it has.
- **Permission** is ranked by `BOT_PERMISSIONS`, strictest first: `auto`
  (Approve for me), then `full` (Full access). The new bot gets the one
  asked for when it is no looser than the creator's, and otherwise the
  stricter of the creator's and the console's default, which is always
  Approve for me today. Full access asked by a bot under Approve for me is
  refused, never quietly lowered (`permissionForBotMadeBy`, held by the
  tool and again by the command, whose insert re-reads the creator's level
  under a row lock and rolls back if it changed since the check).
- **Group** is one of the owner's, by id or name; a bot cannot create a
  group.
- **Once:** the creation is keyed (`bot."idempotencyKey"`, unique per
  workspace): `bot:approval:<id>` for an approved call, the turn and a
  digest of the input otherwise. A retried job or a repeated call answers
  the bot the first one made; two racing ones make one.
- A call the tool would refuse (a keyless provider, an unknown model or
  group, a looser permission) is refused before any card is raised, so the
  person is never asked to approve what cannot run. The card stores the
  call with every default written out (provider, model, effort, level,
  group by id), so a yes creates what the card showed even if the
  creator's engine changed while it waited. The card reads
  `Create bot "Scout" on GLM GLM-5.3, in group Research: Finds papers`.

Two named policies bound bots talking to bots. Both belong to the turn
queue (`bot-turns`, §8): it checks the chain before it enqueues a turn a
bot asked for, and it picks the next turn by lane. Nothing else holds
these numbers.

**`BotChainPolicy`** (`domain/bot-chain.policy.ts`): a chain starts at
one message of yours and counts every turn a bot asks of another bot
because of it (`bot_turn."chainId"`, `"chainDepth"`); the answer to an ask
goes back on its own path and is not counted.

| Limit | Value | Past it |
|-------|-------|---------|
| `maxDepth` | 3 bots deep | the call is refused |
| `turnBudget` | 10 bot-to-bot turns per chain | the call is refused |
| `cycles` | none: a bot already in the chain is never asked | the call is refused |
| self | a bot never messages itself | the call is refused |

A refused call comes back to the asking bot as the tool's result, and the
bot says in its chat that it stopped and why.

**`BotQueueLanes`** (`bot_turn."lane"`): the order a bot's waiting turns
run in, one turn at a time (§2): the oldest of the first lane that has
one.

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
| `web_fetch` | Ours, not the engine's: http(s) to public addresses only, refusing loopback, private and link-local ones (every address a name resolves to, and every redirect, checked; the connection pinned to the checked address), 15 s and 2 MB a fetch, text pages only, 10 a turn | auto |
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

How the card works (built 2026-10-15, `bot_approval`):

- **The turn does not wait on it.** The asking call is stored, exactly as
  validated, as a pending approval with its line; the tool answers the
  model that nothing ran and it should end its turn, and the turn ends. No
  worker is held across a person's time, and a deploy loses nothing.
- **One card per bot.** While one waits, another asking call is told to
  wait for it, and the database holds that if two race.
- **Deciding is a request of its own**
  (`POST /v1/bots/:id/approvals/:approvalId/decision`), a conditional write
  on `pending`: a second click, or a click racing a new message, is
  `BOTS_016` and does nothing. **Approve** moves the card and, in the same
  transaction, stages a `run-approved-call` job (`bot-approvals` queue,
  retried). The job runs exactly the stored call as the owner, in their
  scope resolved now, keyed by the approval (one session per approval
  however often it is retried), and keeps its answer (the card ends
  `failed` when the call failed). A crash leaves a job to retry, never a
  card stuck approved. **Deny** runs nothing, and takes an optional note:
  why not, or what to do instead.
- **No credential reaches further through a card.** The deciding
  credential's scopes are kept on the approval. The call runs only if the
  tool's scope is covered by both the asking turn's scopes and the
  decider's (a browser session restricts neither); otherwise it ends
  `failed`, "Not run: your credential does not cover …", and nothing runs.
- **The bot reports back.** Either way the bot gets a turn of its own,
  under that same intersection of scopes, opened by an **event**: a chat
  message of its own role, written by Oppenheimer, whose words say who
  decided what and the call's answer or the note, and whose fields (kind,
  outcome, tool, the card's line) are what the chat draws, as a trace line,
  never as a bubble from you. The answer and that turn are written together,
  once. The bot reads the words, then and in later history, as a note from
  Oppenheimer and not as your words, and is told not to route around a
  denial.
- **Writing to the bot instead expires the card.** The new turn starts
  fresh; nobody decided, and the bot is not told.
- **Not built yet:** *Always allow* (it needs Settings → Permissions), Off,
  a card for a bot-to-bot or background turn (they will need a timeout
  where yours has none), and the asking tools of the other areas.

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

Built so far of slices 3 and 4 (2026-10-15): the prompt and the turn's
limits (§2); the tools that run without asking, as the owner: itself
(`get_self`, `edit_soul`, `edit_instructions`, `update_profile`,
`remember`, `forget`, `recall`), hosts and sessions (`list_hosts`,
`list_sessions`, `get_session`), the plan (`list_projects`,
`get_project`, `list_tasks`, `get_task`, `plan_summary`, `create_task`,
`update_task`, `move_task`), GitHub (`list_repositories`,
`list_pull_requests`, `get_pull_request`), automations
(`list_automations`, `get_automation`, `run_history`), other bots
(`list_bots`, `get_bot`) and `web_fetch`; `start_session`,
`stop_session` and `create_bot`, which ask; and the Needs input card
(§5): Approve, Deny with a note, the bot told either way. Next:
Settings → Permissions and *Always allow*, then the asking tools of each
area, `ask_bot` and `delegate`.

## 7. Not built yet

Templates (GitHub, Sessions, Plan, and Blank as a template), the built-in
bots (Project manager, Merge manager), group chats with several bots,
Routines, Notifications, plain-language permission rules ("always ask
before touching the payments repo"), daily caps, slash commands, voice,
attachments, the context meter, project and user memory, a bot's engine
running on a host of its own with the full Claude Code toolset.

Routines, a bot waking on a schedule, an event or finished work, are
designed in [26](26-bot-routines.md).

The design's avatar photos are photographs of people; until there is a
set we may use, an avatar is the bot's initials on one of the design's
eight colours (`AV_COLORS`).

## 8. Where things live

- **API:** the `bots` module. `bot`, `bot_group`, `bot_document`,
  `bot_document_revision` (append-only, author you or the bot),
  `bot_memory_fact`; from slice 2 `model_provider_credential`, `bot_turn`
  and `bot_message`; from slice 3 `bot_tool_permission` and
  `bot_approval`; for long conversations `bot_conversation_summary`.
  Workspace-scoped like automations, with the `Bot`
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
  now (beside it `bot-approvals`, an approved call, and `bot-summaries`, a
  conversation's summary); the same image can run it alone when turns need their own
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
- **A first chat that sets the bot up** (§1), from Grok Bot's guide: one
  focused job per bot, a description of what it owns and must never do
  without approval, a first concrete task.

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
- 2026-10-15: **a new bot starts on the workspace's default provider**:
  the one marked in Settings → Model providers, else Anthropic when it
  has a key, else the first provider with one (§2).
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
- 2026-10-15: **the system prompt is ours from the first line**, with a
  closed list of what the bot can do and the moment it runs in (the
  sender's time zone, its home host, the owner's hosts), and **a turn
  stops after 4 minutes**. From the battle tests and Grok Bot's prompt
  (`research/lessons-from-grok-bot.md` §5): without them a bot searched
  the server for what it lacked, asked people to paste tokens, answered
  in UTC and ran on to any length.
- 2026-10-15: **the system prompt is stable; the moment opens the
  message.** The prompt's "Right now" section (the time, the home host,
  the hosts) changed every turn, so the provider's prompt cache never
  hit. It moved to a `<turn_context>` block at the start of each turn's
  message, which the prompt names as Oppenheimer's and authoritative. It
  replaces that part of the line above.
- 2026-10-15: **history is a token budget, with a stored summary of
  what falls out**, replacing the last 40 messages (§2): a long
  conversation keeps its early facts and decisions instead of losing
  them silently, and short messages no longer cap it at 40.
- 2026-10-15: **a Needs input card ends the turn that raised it.** The
  decision runs the stored call (on a yes) and gives the bot a new turn,
  opened by an *event* message, rather than holding a turn open while the
  card waits; a new message from you expires the card. From Grok Bot's
  parked turns (`research/lessons-from-grok-bot.md`), which BullMQ cannot
  park.
- 2026-10-16: **the page is Home host, and bot settings save with Save.**
  Read as "Runs on", the page looked like where the bot runs, which is
  always Oppenheimer; it is where `start_session` puts a session when no
  machine is named, and *No home host* has the bot ask. A pick, on Home
  host or Profile (colour and sidebar group included), is a draft until
  Save. It replaces slice 3's "Settings → Runs on becomes Works on"; the
  old address redirects.
- 2026-10-18: **an ask's answer comes back as a turn, not by waiting.**
  It replaces "give another bot a task and wait for its answer": one turn
  per bot runs at a time and a turn has four minutes, so an ask that held
  its turn open would wait behind the other bot's queue and could time out
  or deadlock two bots asking each other. The asker ends its turn and the
  answer opens a new one (`bot_reply`), the way a decided card does. The
  sender is recorded rather than claimed, a message holding a credential
  is refused, and the chain is decided under a lock, from
  `../../research/agent-coordination-experiments.md`.
- 2026-10-16: **chat history is exported and cleared from Profile.**
  Export downloads the whole chat as Markdown (`GET
  /bots/:id/conversation/export`, every message as a line of NDJSON, read
  and written a page at a time);
  Clear history (`DELETE /bots/:id/conversation`) erases the turns,
  messages, cards and summary in one transaction, keeps the soul,
  instructions and memory, and is refused while a turn works (`BOTS_022`).
- 2026-10-16: **a blank bot is born with a first name and sets itself up
  in its first chat** (§1). It replaces "New Bot" and a one-line "ask
  what job": a sidebar of "New Bot 2, New Bot 3" told bots apart by
  nothing, and a bot left to the person to find Settings rarely got
  instructions. It keeps 2026-10-14's "created blank": no template is
  applied, the person's answer is.
