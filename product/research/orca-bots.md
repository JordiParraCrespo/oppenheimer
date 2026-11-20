# Orca's bots beside ours (2026-11-20)

The owner asked how Orca's bots compare with ours. Orca (Stably, MIT,
`orca.dev`, formerly `onorca.dev`) is the desktop app note 00 calls our
closest analogue. Bots first appear in its changelog at 1.4.265, released on
2026-11-19 ("Work with Orca Bots — managed agent sessions get their tools
and identity"), so this reads a feature that is one day old.

Sources: `orca.dev/bots`, `orca.dev/docs/bots`, `…/docs/bots/connectors`,
`…/docs/bots/security`, `…/docs/bots/import`, `…/docs/cli/automations`,
`…/docs/cli/orchestration` and `orca.dev/changelog`, all fetched on
2026-11-20, plus the directory listing of `github.com/stablyai/orca`
`src/main/bots`. No Orca code was read. Claims quoted from the pages are
marked as read. Claims drawn from file names, or from a page's silence, are
marked as inferred. Our side is the user guide (`apps/docs/docs/guide/bots.md`,
`routines-and-watches.md`, `bot-skills.md`) and notes
`versions/mvp/25-bots.md` and `26-bot-routines.md`.

## 1. The one real difference: where the bot's loop runs

| | Orca | Oppenheimer |
| --- | --- | --- |
| The bot's own loop | A Claude Code or Codex session (or another supported agent) that "lives in a folder on one computer" (read) | An LLM loop inside the control plane. It has no shell, no files and no host (25 §1) |
| Who pays for the model | The user's agent subscription: "no new model bill, no markup" (read) | A workspace key per provider (Anthropic, OpenAI, xAI, GLM), or a ChatGPT sign-in that bills the subscription |
| Code work | Hands off to **workers**: CLI sessions, each in its own worktree. The worker's pull request "comes back to the bot", and the bot "hands you the worktree" (read) | Starts a **session** on a host, then follows it: it wakes on input, done, failed or stuck, and reviews the work every ten minutes for up to an hour |
| When the computer sleeps | Requests wait in Orca Cloud for up to a day (read). The bot itself is down while the machine is | The bot keeps answering. Only the sessions it starts need a host |
| Persona and memory | Soul and memory as Markdown files in the bot's folder that you can edit (read) | `SOUL.md` and `INSTRUCTIONS.md` with revision history; two memories (the bot's own, and a general one that all bots share), tidied daily, with an About you page |

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
| Groups | Groups in the + menu. `bot-group-*` files (membership, peer requests, delivery) suggest that bots in a group message each other (inferred) | Groups for sidebar order only. Bot-to-bot is `message`/`ask`, at most 3 bots deep and 10 bot-to-bot turns |
| Chat reach | `@bot` in Orca chat; **Slack** (one Slack app per bot); a GitHub mention; Linear (`@Orca <handle>`, label `bot:<handle>`); the phone app starts jobs. No Telegram | The console only. Mail, WhatsApp and Telegram are tools a bot uses, not ways to talk to it (guide, "Not available") |
| Event triggers | GitHub (issues, PRs, pushes, comments, reviews, review requests, labels, CI, conflicts, merges, deploys, security alerts, workflow runs); Linear (assigned, mention, new, moved); Gmail; **Calendar**; **webhooks** (signed, rotatable); schedules with cron or RRULE | GitHub (a comparable list, without deploys, security alerts or conflicts); Gmail; schedules from presets. No webhook trigger, no Calendar, no Linear |
| Watches within a task | Not described (inferred absent) | Sessions (input, done, failed, stopped), pull requests, projects and milestones; stall check; work review every ten minutes; `/loop`, `/goal` |
| Tools | MCP servers, skills, Google, Composio apps | Oppenheimer's own tools (sessions, hosts, plan, GitHub, automations, mail, WhatsApp, Telegram, other bots), web search and fetch, read-only subagents. No MCP |
| Permissions | Ask for approval, Accept edits, Approve for me, Full access. "Orca's default chat permission is Full access". Enforced: who can ask, read-only scheduled reviews, a tool-less memory tidy. "Draft, don't send" and "merge only when asked" are only prompts: "None of these settings is a guarantee" | Approve for me or Full access, plus Allow/Ask/Off per tool, standing grants and plain-language rules. Sending, scheduling or trashing mail always asks. A merge is pinned to the head shown on its card. All enforced in the control plane |
| Who may ask a bot | Only you by default. People you add act with *your* access | Only you: workspaces are personal (note 08) |
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
2. **Following the work.** Session and pull-request watches, stall checks,
   the regular review, goals and loops. Orca's docs describe none of these
   for a bot.
3. **Uptime.** Our bot answers while every host is asleep. An Orca bot does
   not.
4. **Memory.** A memory shared by every bot plus each bot's own, an About
   you page, and a daily tidy with undo.
5. **Bot-to-bot**, documented and bounded. Orca's groups have no docs yet.
6. **No vendor cloud** holding webhook bodies and messages.

## 4. What we could take (proposals; this note decides nothing)

The notes that own each area decide these.

1. **A webhook trigger for routines**, signed and rotatable, with the body
   marked as outside data like mail is today. Our guide already lists it as
   not built (`26-bot-routines.md`).
2. **Asking a bot from a GitHub mention or a label** (`bot:<name>`), with
   the answer in the pull request or issue. The GitHub App already receives
   these events. This is the smallest form of Orca's main reach
   (`25-bots.md` §4.4, `next-steps/channels.md`).
3. **Bot templates**, created with their routines paused, which is Orca's
   safe default (`25-bots.md` §1).
4. **cron/RRULE schedules** and a **precheck** (a cheap condition that skips
   a run) on routines and automations (`26-bot-routines.md`).
5. **Import** from OpenClaw or Hermes, mapping them to `SOUL.md`, memory,
   skills and paused routines. This has low value until someone asks for it.

Not to take:

- Running the bot's loop as a CLI session on a host. It would cost our
  uptime and our enforced permissions, and §1 is the reason the two
  products differ.
- Full access as the default for a bot.
- Holding inbound text in a relay on the vendor's side.

## 5. Not known

- How Orca's bot groups behave, and how bots talk to each other.
- The layout of the bot folder.
- The webhook payload.
- Orca Cloud's limits and pricing.
- What happens to a bot's own schedules while its computer sleeps.

Check again once Orca's bot docs are older than a day.
