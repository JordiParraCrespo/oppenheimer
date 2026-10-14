# 25 — Bots: a general bot, end to end

The 2026-10-13 and 2026-10-14 exports (`design/version1/Bots.dc.html`,
`BotSettings.dc.html`, `catalog.js`) draw the **Employees** section: a
sidebar of bots in groups, a chat with each, and a settings page per bot.
This note is what gets built first: **one general bot**, one you create
blank, chat with, and shape. The owner settled the questions in
conversation on 2026-10-10 to 2026-10-14; they are under "Decided" at the
end, and the sections are written to match.

The console calls the section **Employees**; everywhere inside the
product (code, tables, routes, copy in the section) the thing is a
**bot**.

## 1. What a bot is

A bot is a worker you talk to: a Claude Code conversation that lives on
one host (its **home host**), in its own folder there
(`<work folder>/<account>/<workspace>/agents/<bot-id>/`, 24 §2), with
what it is and what it knows kept in the API.

| Part | Stored as | Shown as |
|------|-----------|----------|
| Who it is: name, description, avatar, sidebar group | Columns on `bot` | Settings → Profile |
| `SOUL.md`: persona and tone | A document with revisions | Settings → Instructions |
| `INSTRUCTIONS.md`: its job and rules | A document with revisions | Settings → Instructions |
| What it remembers | Rows, one fact each | Settings → Memory |
| Where it runs | `bot.homeHostId` | Settings → Runs on |
| How it is started: model, effort, approval level | Columns on `bot` | The chat's composer |
| The conversation | Turns and messages | The chat |

Postgres is the source of truth. The files a bot reads on its host are a
rendering of the rows, written by the runner before each turn; a bot
never edits them. It changes what it is and what it knows only through
Oppenheimer's tools (§4), and a change it proposes to its own soul or
instructions waits for you.

## 2. What is built, in four slices

Each slice is its own pull request, green on `pnpm ci:local`, checked on
the local stack, with screenshots.

1. **The bot without a runtime.** Tables and endpoints; the Employees
   section with its sidebar (search, groups, rows); **New bot** creates a
   blank bot ("New Bot", no instructions) and opens its chat, which shows
   its hello and says the chat comes next; Settings → Profile,
   Instructions (edit, revisions, revert), Memory (facts by hand) and
   Runs on (home host); delete.
2. **The chat.** Each message is one **headless turn** on the home host
   (16 §Q2–Q3, built here for the first time): the runner refreshes the
   bot's folder and runs `claude -p --output-format stream-json --resume
   <conversation>` in it, tailing the output to a file so a runner
   restart loses nothing; the API turns the lines into chat messages
   (text, tool steps, the result) and pushes them to the console. One
   turn at a time per bot; your next message waits. Stop cancels the
   turn. A home host that is offline holds the message until it is back.
3. **It writes its own instructions.** `runner mcp`, an MCP server over
   stdio in the bot's folder, forwards tool calls through the link to the
   API: `propose_instructions`, `remember`, `forget`, `list_memory`. A
   blank bot's first answer proposes its INSTRUCTIONS.md; the proposal is
   a card in the chat and in Settings, Accept or Reject. "Learn
   automatically" lets `remember` save without asking.
4. **Approvals.** `request_approval` as Claude Code's
   `--permission-prompt-tool`: the turn waits on a **Needs input** card
   (Approve once, Always allow, Deny, or tell it what to do instead).
   *Ask for approval* is offered from this slice; before it, the composer
   offers *Approve for me* and *Full access* only, because a headless
   turn with no prompt tool would refuse every tool.

## 3. Not built yet

Templates (GitHub, Sessions, Plan, and Blank as a template), the built-in
bots (Project manager, Merge manager), Teammates and group chats,
Routines, Notifications, Access (projects, tools, MCP connectors), daily
caps, slash commands, voice, attachments, the context meter, project and
user memory, and models other than Claude Code's.

The design's avatar photos are photographs of people; until there is a
set we may use, an avatar is the bot's initials on one of the design's
eight colours (`AV_COLORS`).

## 4. Where things live

- **API:** a `bots` module. `bot`, `bot_group`, `bot_document` (the
  current soul and instructions), `bot_document_revision` (append-only,
  author you or the bot), `bot_memory_fact`; from slice 2 `bot_turn` and
  `bot_message`; from slice 3 `bot_proposal`; from slice 4
  `bot_approval`. Workspace-scoped like automations, with the `Bot`
  policy subject and the `bots:read` / `bots:write` scopes.
- **Wire:** from slice 2, `bot.turn` and `bot.turn.cancel` to the runner,
  the turn's output lines and `turn.ended` back; from slice 3 the tool
  calls, as requests the API answers (the reply mechanism `fs.list`
  introduced, 24 §5).
- **Runner:** the bot's folder `agents/<bot-id>/` with
  `.oppenheimer/meta.json`, the generated `CLAUDE.md` and `.mcp.json`;
  `runner mcp`.
- **Console:** the rail's Employees entry opens `/bots`; a bot's chat is
  `/bots/<id>` and its settings `/bots/<id>/settings/<tab>`.

## Decided

- 2026-10-14: the first bot built is a **general** one: created blank,
  shaped by chat and settings. No templates and no built-in bots yet.
- 2026-10-14: inside the product it is a **bot**; the nav keeps
  **Employees**.
- 2026-10-14: a chat message is a **headless turn** on the bot's home
  host, not a long-lived terminal.
- 2026-10-14: *Ask for approval* comes with approvals (slice 4).
- 2026-10-11: bots' documents and memory live in Postgres; the files on a
  host are renderings; a bot writes only through Oppenheimer's tools, and
  a change to its own soul or instructions waits for you.
- 2026-10-14: no photos of people as avatars; initials on a colour.
