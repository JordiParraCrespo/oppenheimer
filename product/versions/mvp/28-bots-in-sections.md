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
- **Three ways to place one.** The plus on a section's Bots heading opens
  a menu (slice D): New bot makes a blank bot already placed there and
  opens its chat, where it sets itself up (25 §1); under it every bot is
  listed with a check for whether this section shows it, which flips the
  moment it is clicked; the foot links to Employees. Until 2026-10-28 the
  plus only made a new bot. Settings → Profile's **Shows in** is a pill per section that
  saves when it flips. The bot itself, through `update_profile`, which now
  takes `sections`, so its first chat can put it where its job is.
- **Where a row opens.** Inside the section it was clicked in, beside the
  section's own list: `/sessions/bots/$botId`, `/automations/bots/$botId`,
  `/plan/bots/$botId`, `/pulls/bots/$botId` (`botChatDestination`). The
  reader never leaves the section for a bot; it is the same chat as in
  Employees. Deleting the bot from there lands on the section's own page.
  At first only Pull requests opened in place, as
  `PullRequests.dc.html` draws it, and the other three opened Employees, as
  their frames link it (see "Decided").

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
  read by `useSuspenseSectionBots`, which narrows the one bots read, in the
  order `GET /v1/bots` serves: Employees', groups by position then
  Ungrouped). Its rows drag (`useSectionBotOrder`): a drop is the bot's
  `groupId` and `position` in Employees (`placementInSection`), the write
  the Employees drag already makes. The
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
- **D. Each page manages its own Bots heading**, built 2026-10-28. The
  owner, trying slice A: a page could make a bot but not show one already
  made, and hiding one meant leaving for its settings. The plus is now a
  menu (New bot, Show in *section* with a check per bot, Manage in
  Employees); a row's ellipsis has Settings and Hide from *section*, which
  takes it off this sidebar only; the empty line reads "No bots here yet.
  Add one" and opens the same menu. Grouping, order and delete stay in
  Employees, so a page chooses which bots it lists and nothing else: no
  per-page order, no per-page groups. No API change: each write is the
  `sections` set `PATCH /v1/bots/:id` already takes. (Order moved on
  2026-10-29: a heading's rows drag too, into the one Employees order; see
  "Decided".)

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
- 2026-10-26: **every section opens a bot's chat in place.** The owner,
  trying it: clicking a bot in Sessions should not navigate away. It
  replaces the line above: Sessions, Automations and Plan open the chat
  under their own address and sidebar, as Pull requests does, where their
  frames link Employees.
- 2026-10-28: **a section's plus is a menu that places any bot, and a row
  hides itself from its section** (slice D). The owner wanted to manage
  each page's bots from that page. It replaces "the plus makes a blank bot"
  in §1; Employees keeps groups, order and delete.
- 2026-10-29: **a section's Bots heading drags its bots into order, and the
  order is Employees'.** The owner wanted bots reorderable on every page that
  shows them, the same order on each. There is still no per-page order: a
  drop under a heading puts the bot between the same two bots in Employees,
  staying in its group when either neighbour is in it, else joining the
  group of the one above (below, when dropped first), so Employees and every
  other heading follow. `GET /v1/bots` now serves the Employees order (it
  had been Ungrouped first, then groups by id). Pointer and keyboard (Space
  picks a row up, the arrows move it, Space drops it, Enter still opens the
  chat), with the drag layer's announcements. Replaces "Grouping, order and
  delete stay in Employees" in slice D for the order only.
