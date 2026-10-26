# 28 — Bots in the console's sections

**Decided 2026-10-26; slice A built.** The 2026-10-25 export
(`design/version1/SessionsConsole.dc.html`, its Automations page
`Routines.dc.html`, `Tasks.dc.html`, `PullRequests.dc.html`) puts a **Bots**
heading in every console section's sidebar: a plus that makes a bot, then
rows drawn as in Employees (initials on a colour, name, age, last line).
Sessions shows a "Session Bot", Automations an "Automation Bot", Plan a
"Planning Bot", Pull requests a "Release Bot". This note is how a bot gets
there. The Inbox (`Brain.dc.html`, bot questions and approvals waiting on
the person) is another person's work and is not in it.

## 1. The shape

A bot lives once, in Employees (25 §1): one conversation, one memory, one
set of documents. A section does not get bots of its own; it **lists the
bots placed in it**.

- **`bot.sections`** is the set of sections whose sidebar lists the bot:
  `sessions`, `automations`, `plan`, `pulls` (`BOT_SECTIONS` in
  `@oppenheimer/shared`). Empty by default, so every bot shows in Employees
  only until it is placed.
- **Three ways to place one.** The plus on a section's Bots heading makes a
  blank bot already placed there and opens its chat, where it sets itself
  up (25 §1). Settings → Profile's **Shows in** is a pill per section that
  saves when it flips. The bot itself, through `update_profile`, which now
  takes `sections`, so its first chat can put it where its job is.
- **Where a row opens.** In Pull requests the chat opens inside the section
  (`/pulls/bots/$botId`), beside the section's own list, as
  `PullRequests.dc.html` draws it. In Sessions, Automations and Plan the row
  opens the bot in Employees (`/bots/$botId`), as those frames link it. It is
  the same chat either way.

Deriving the placement from the bot's permissions (a bot with the pull
request tools shows in Pull requests) was considered first and not taken:
per-tool permissions are not built yet (25 §5), so every bot has every
tool and would show everywhere. A placement the owner (or the bot) chooses
says what the bot is *for*, which permissions do not.

## 2. Where things live

- **API:** `bot."sections"`, `varchar(16)[]` with a `CHECK` on its values
  (`1791003500000-AddBotSections`). `POST /v1/bots` and `PATCH /v1/bots/:id`
  take `sections`; the bot's response carries it in catalog order. The
  domain keeps each section once, in catalog order, however it was sent.
- **Bot tools:** `update_profile` takes `sections` (the whole set); `get_self`
  says where the bot shows.
- **Console:** the bots feature draws the heading (`SectionBots`, its rows
  read by `useSuspenseSectionBots`, which narrows the one bots read). The
  route's `ConsoleSidebar` hands it to each section's sidebar, which places
  it where the design does: under New session, under New automation, under
  Plan's three views (on the calendar too), and in Pull requests between the
  views and For review. Features still never import each other.

## 3. Slices

- **A. Placement and the four headings**, built: the column, the create and
  update inputs, `update_profile`, the headings in Sessions, Automations,
  Plan and Pull requests, the chat inside Pull requests, Shows in.
- **B. A chat that knows where it was opened.** A message sent from a
  section, or about one item (this pull request, this task), carries that
  item into the turn's `<turn_context>`, so "merge this" needs no number.
- **C. Who acted.** A session or a pull request comment a bot made shows
  "Started by" or "via" the bot in its section (the session row's bot glyph
  in `SessionsConsole.dc.html`). Sessions record `origin: 'bot'` today, not
  which bot.

## Not in this note

- **The Inbox** and its bot questions and approvals: built by someone else.
- **The built-in Oppenheimer bot** the 2026-10-25 export lists first under
  every Bots heading. 25 decided on 2026-10-14 that there are no built-in
  bots yet; that stands until the owner changes it.

## Decided

- 2026-10-26: **a section lists the bots placed in it**, by a set on the
  bot that the owner, the section's plus and the bot itself can change,
  not by its permissions. Every bot stays in Employees.
- 2026-10-26: **Pull requests opens a bot's chat inside the section**;
  Sessions, Automations and Plan open it in Employees, as the export links
  them.
