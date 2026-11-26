# Orca's bots beside ours (2026-11-20)

The owner asked how Orca's bots compare with ours. Orca (Stably, MIT,
`orca.dev`, formerly `onorca.dev`) is the desktop app `../archive/vision-and-plan.md` calls our
closest analogue. Bots first appear in its changelog at 1.4.265, released on
2026-11-19 ("Work with Orca Bots — managed agent sessions get their tools
and identity"), so this reads a feature that is one day old.

Sources: `orca.dev/bots`, `orca.dev/docs/bots`, `…/docs/bots/connectors`,
`…/docs/bots/security`, `…/docs/bots/import`, `…/docs/cli/automations`,
`…/docs/cli/orchestration` and `orca.dev/changelog`, all fetched on
2026-11-20, plus the directory listing of `github.com/stablyai/orca`
`src/main/bots`. §6 (added the same day) reads Orca's source at commit
`8e0c267e` (2026-11-20). It confirms most of the docs and corrects a few
rows below, which now cite it. Paths there are relative to Orca's `src/`.
Claims drawn from file names, or from silence, are marked as inferred. Our side is the user guide (`apps/docs/docs/guide/bots.md`,
`routines-and-watches.md`, `bot-skills.md`) and
`design/bots/bots.md` and `design/bots/bot-routines.md`.

## 1. The one real difference: where the bot's loop runs

| | Orca | Oppenheimer |
| --- | --- | --- |
| The bot's own loop | A Claude Code or Codex session (or another supported agent) that "lives in a folder on one computer" (read) | An LLM loop inside the control plane. It has no shell, no files and no host (`../design/bots/bots.md` §1) |
| Who pays for the model | The user's agent subscription: "no new model bill, no markup" (read) | A workspace key per provider (Anthropic, OpenAI, xAI, GLM), or a ChatGPT sign-in that bills the subscription |
| Code work | Hands off to **workers**: CLI sessions, each in its own worktree. The worker's pull request "comes back to the bot", and the bot "hands you the worktree" (read) | Starts a **session** on a host, then follows it: it wakes on input, done, failed or stuck, and reviews the work every ten minutes for up to an hour |
| When the computer sleeps | Requests wait in Orca Cloud for up to a day (read). The bot itself is down while the machine is | The bot keeps answering. Only the sessions it starts need a host |
| Persona and memory | `~/.orca/bots/<folder>` holds `SOUL.md`, `MEMORY.md` (one dated line per fact, first 200 lines loaded), `memory/<topic>.md`, and Orca's generated `AGENTS.md`. Memory is per bot, with no shared memory; a nightly tidy runs with no tools (§6) | `SOUL.md` and `INSTRUCTIONS.md` with revision history; two memories (the bot's own, and a general one that all bots share), tidied daily, with an About you page |

Orca's choice makes the bot a terminal agent with a persona around it. It
can do anything the CLI can, and it costs nothing beyond the subscription
the user already pays for. Ours is a chat-only agent that controls terminal
agents. It stays available while the user's computers are off, and its tool
access is limited by Oppenheimer's own permission layer. The first gap below
follows from this difference.

## 2. Side by side

| Area | Orca (read unless marked) | Ours |
| --- | --- | --- |
| Creating a bot | New bot: name, picture, a one-sentence purpose, which computer and which agent. **24 templates** (their schedules start off), or describe the job in plain language | New bot gets a physicist's name and a drawn face. Its first chat writes its own `INSTRUCTIONS.md`. No templates (guide, "Not available") |
| Importing a bot | From OpenClaw or Hermes: the persona becomes the soul, notes become memory, skills become "abilities", schedules arrive paused | None |
| Groups | A group is a shared conversation of bots with a reply mode (`bot`, `all`, `mentions`). A bot's request to a peer must trace back to a verified post by the human owner; no hop or turn counter was found (§6) | Groups for sidebar order only. Bot-to-bot is `message`/`ask`, at most 3 bots deep and 10 bot-to-bot turns |
| Chat reach | `@bot` in Orca chat; **Slack** (one Slack app per bot); a GitHub mention; Linear (`@Orca <handle>`, label `bot:<handle>`); the phone app starts jobs. No Telegram | The console only. Mail, WhatsApp and Telegram are tools a bot uses, not ways to talk to it (guide, "Not available") |
| Event triggers | GitHub (issues, PRs, pushes, comments, reviews, review requests, labels, CI, conflicts, merges, deploys, security alerts, workflow runs); Linear (assigned, mention, new, moved); Gmail; **Calendar**; **webhooks** (signed, rotatable); schedules with cron or RRULE | GitHub (a comparable list, without deploys, security alerts or conflicts); Gmail; schedules from presets. No webhook trigger, no Calendar, no Linear |
| Watches within a task | A worker's turn stopping (finished, errored, needs input, exited, lost) and its permission prompts wake the bot. Pull requests do **not**: the bot must make a one-off automation on the PR's CI and review events. A read-only look-around runs every 4 hours on weekdays by default. No stall timer found (§6) | Sessions (input, done, failed, stopped), pull requests, projects and milestones; stall check; work review every ten minutes; `/loop`, `/goal` |
| Tools | The CLI's own tools (shell, files), the `orca` CLI and `gh` through the shell, the owner's MCP servers plus its own, Composio, Google. No Orca MCP server is injected (§6) | Oppenheimer's own tools (sessions, hosts, plan, GitHub, automations, mail, WhatsApp, Telegram, other bots), web search and fetch, read-only subagents. No MCP |
| Permissions | The CLI's own modes: Claude Code `default`, `acceptEdits`, `auto`, or `--dangerously-skip-permissions` for Full access; Codex's approval and sandbox policy. The default is Full access (`shared/settings/default-global-settings.ts:174,270`). Merging and sending mail have no gate in code; the rules are prompt text (`main/bots/bot-preamble.ts:58`). What code does enforce: read-only background runs, through a PreToolUse hook that overrides Full access | Approve for me or Full access, plus Allow/Ask/Off per tool, standing grants and plain-language rules. Sending, scheduling or trashing mail always asks. A merge is pinned to the head shown on its card. All enforced in the control plane |
| Who may ask a bot | Only you by default. People you add act with *your* access | Only you: workspaces are personal (`../design/foundations/auth.md`) |
| Where results land | In the thread, pull request or issue where the bot was asked; a "Needs you" queue across bots | The bot's chat; Needs input cards; the Inbox |
| Data held by the vendor | Orca Cloud relays Slack, GitHub, Linear and webhooks, and keeps some text, including webhook bodies, for up to 7 days | Everything is held by Oppenheimer, which runs the control plane |

Orca also has two adjacent features that are not bots. **Automations** are
scheduled prompts with `--precheck "<cmd>"` (a non-zero exit skips the run),
missed-run grace, and fresh or reused sessions; they are the counterpart of
our automations. **Orchestration** (experimental) has a coordinator agent
dispatch workers in worktrees, with typed inbox messages (`worker_done`,
`escalation`, `question`, `heartbeat`) and decision gates. It is the
counterpart of a bot following its sessions, but here the coordinator is
itself a CLI agent.

## 3. Where each is ahead

**Orca is ahead on:**

1. **Reach.** A bot can be asked from where the work already is: Slack, a
   GitHub or Linear mention, a label. Our bots are reached only in the
   console.
2. **Triggers.** Webhooks, Calendar, Linear, and cron or RRULE schedules.
   Our routines lack all four (guide, "Not available yet").
3. **Getting started.** 24 templates, and import from OpenClaw or Hermes.
4. **Tools beyond its own.** MCP and Composio give a bot any SaaS without a
   connector of Orca's. Ours can reach only what Oppenheimer builds.
5. **Cost.** The bot runs on the subscription the user already pays for.
   Our ChatGPT sign-in does the same for one provider only.

**We are ahead on:**

1. **Enforced limits.** Orca says outright that its "don't send" and
   "merge only when asked" are prompts. Ours are tool permissions, cards
   and always-ask calls.
2. **Following the work.** Orca wakes a bot when a worker stops, but not on
   pull requests, and has no stall check, goals or loops. We have pull
   request and project watches, a stall check, a review every ten minutes,
   goals and loops.
3. **Uptime.** Our bot answers while every host is asleep. An Orca bot does
   not.
4. **Memory.** A memory shared by every bot plus each bot's own, an About
   you page, and a daily tidy with undo.
5. **Bot-to-bot with hard limits.** Orca's groups require a human-rooted
   request but count no hops or turns.
6. **No vendor cloud** holding webhook bodies and messages.

## 4. What we could take (proposals; this note decides nothing)

The notes that own each area decide these.

1. **A webhook trigger for routines**, signed and rotatable, with the body
   marked as outside data like mail is today. Our guide already lists it as
   not built (`../design/bots/bot-routines.md`).
2. **Asking a bot from a GitHub mention or a label** (`bot:<name>`), with
   the answer in the pull request or issue. The GitHub App already receives
   these events. This is the smallest form of Orca's main reach
   (`../design/bots/bots.md` §4.4, `design/channels/channels.md`).
3. **Bot templates**, created with their routines paused, which is Orca's
   safe default (`../design/bots/bots.md` §1).
4. **cron/RRULE schedules** and a **precheck** (a cheap condition that skips
   a run) on routines and automations (`../design/bots/bot-routines.md`).
5. **Import** from OpenClaw or Hermes, mapping them to `SOUL.md`, memory,
   skills and paused routines. This has low value until someone asks for it.

Not to take:

- Running the bot's loop as a CLI session on a host. It would cost our
  uptime and our enforced permissions, and §1 is the reason the two
  products differ.
- Full access as the default for a bot.
- Holding inbound text in a relay on the vendor's side.

## 5. Still not known

- The Orca Cloud side: whether it filters incoming messages by a bot's
  member list (the machine sends the list, `connector-cloud/connector-places.ts:71-100`),
  how long it keeps what, and its pricing. That code is not in the
  repository.

## 6. From the source (commit `8e0c267e`, 2026-11-20)

This section was read by an agent and spot-checked by hand. The rows
marked ✓ were opened and read directly.

1. **A bot is a native chat session.** For Claude it is the `claude` CLI in
   stream-json mode, through the Agent SDK's `query()`, with the bot's rules
   appended to the `claude_code` system prompt
   (`main/claude/structured/launch/claude-bot-session-options.ts:38`). For
   Codex it is the app-server. Eleven agent CLIs are allowed; the default is
   Claude. Each bot has one ongoing Chat, and turns queue into it
   (`main/bots/bot-chat-session.ts:1` ✓).
2. **Tools come through the shell.** The rules tell the bot to use the
   `orca` CLI (`orca linear|slack|gmail|calendar|automations|bot …`) and
   `gh` (`main/bots/bot-preamble.ts:14-45`). For code it must not edit
   anything itself: it runs `orca orchestration worker-start --worktree
   new-child …` and ends its turn (`bot-preamble.ts:69-74`). Workers nest at
   most 4 deep and report by mailbox (`worker_done`, `heartbeat`,
   `escalation`, `status`).
3. **Permissions are the CLI's.** Full access passes
   `--dangerously-skip-permissions`
   (`main/claude/structured/launch/claude-structured-permission-options.ts:12-29` ✓).
   A bot with no mode of its own takes the global default, which is
   `full-access` (`shared/settings/default-global-settings.ts:174,270` ✓).
   "Approve, request changes or merge only when your owner asks" is a line
   of the prompt (`bot-preamble.ts:58` ✓). `google.gmail.send` has no
   approval check. The one hard gate is a PreToolUse hook that keeps
   look-around and tidy runs read-only "over the user's allow rules and
   full access" (`main/claude/claude-structured-read-only-options.ts:11-49`).
4. **Pull requests do not wake a bot.** `BotPrWaker` is inert: events are
   "accepted and dropped" (`main/bots/bot-pr-events.ts:1-13` ✓). The bot
   makes a one-off automation (`--once`, optional `--by` deadline) on the
   PR's CI and review events, giving the worker 2 tries to fix it
   (`bot-preamble.ts:61,75-79`). PRs opened by the bot's own workers never
   fire its `from=me` rules (`own-pr-trigger-guard.ts`).
5. **Sleep is handled with care.**
   - Scheduled runs wait until the machine has been awake for 2 minutes.
   - A run missed by more than its grace window (default 720 minutes) is
     recorded as missed, with repeats folded into one row.
   - Background runs start only on a full wake, not a macOS dark wake.
   - Their time limit counts only awake time, and the desktop holds off
     idle sleep while one runs (`main/bots/bot-background-run*.ts`,
     `main/power/awake-clock.ts:18`).
6. **Memory.** The agent edits `MEMORY.md` itself. At the end of each turn
   Orca puts back any line removed other than through `orca bot memory
   forget` (`bot-memory-record.ts:1-3`). The nightly tidy (3–8 AM) runs
   with no tools, and Orca validates and writes its draft. It aims for
   about 60 facts, adds at most 6 lines and files at most 20 into topic
   files (`shared/bots/bot-tidy-up.ts:17-38`). Memory reaches the agent
   marked "notes, not instructions".
7. **Templates and import.** 24 templates (6 coding, 4 release, 4 support,
   4 planning, 6 ops/personal) under
   `shared/bots/bot-template-catalog/`, built from 13 built-in skills;
   schedules are created off. Import has no parser. Orca finds OpenClaw,
   Hermes and OpenBot folders, and the new bot reads them itself through a
   secret-filtering `orca bot import read`, following a guide. Every
   imported automation is created `--disabled`
   (`skill-guides/orca-cli/references/bot-import.md`).
8. **Quiet turns** end with a marker, and no one is notified
   (`bot-preamble.ts:67`). Each bot has three notification switches: needs
   permission, task complete, could not finish. A stop for a usage limit
   can continue on its own. There is no token or cost budget in the bot
   code.

What this adds to §4:

- **An own-pull-request guard.** Check whether a routine on "pull request
  opened" fires for a pull request that the bot's own session opened. If it
  does, add Orca's guard (`../design/bots/bot-routines.md`).
- **Restoring memory lines.** A fact removed outside `forget` comes back.
  This matters only if a bot ever edits its memory as a file; ours goes
  through tools.
- **Import stays cheap.** Orca writes no parser and has the bot read the
  old files through a filter. That is the shape to copy if §4.5 is ever
  wanted.
