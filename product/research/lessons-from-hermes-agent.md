# Lessons from Hermes Agent (2026-11-09)

The owner asked what Oppenheimer can bring from Hermes Agent, Nous
Research's open-source agent (MIT, released February 2026). This note reads
its published docs; no code is taken, and its repository was not read. What
was seen on a fetched page is marked as such; the rest is inference and says
so. What `versions/mvp/25-bots.md` built from it is in §4.1 (Skills) and
§4.2 (`search_sessions`).

Sources: `hermes-agent.nousresearch.com/docs` (the landing page, fetched),
and third-party write-ups for what that page names without describing
(`jimmysong.io/ai/hermes-agent`, `agentic-ai.readthedocs.io`,
`pyshine.com`). The performance numbers quoted for it (a gain on long tasks
from skills it wrote itself) are Nous Research's own benchmarks; none is
used here.

## 1. What Hermes is (seen on its docs)

- **A learning loop.** The agent curates its own memory "with periodic
  nudges to persist knowledge", creates skills from experience without
  being asked, and improves a skill while using it. Skills follow the
  agentskills.io format and can be shared through a hub.
- **Recall across sessions.** Every past session is searchable with
  SQLite FTS5, the hits summarised by a model. Honcho builds a model of the
  user across sessions. `SOUL.md` sets a personality; context files shape
  each conversation.
- **A gateway to 20+ chat platforms** from one process (Telegram, Discord,
  Slack, WhatsApp, Signal, Matrix, email, SMS and more), with a CLI and a
  desktop app.
- **Named bots**, each with its own model, memory, skills, routines and
  chats; specialist bots share a group chat and answer when mentioned.
- **Cron**, with a run's result delivered to any platform.
- **Subagents** for parallel work, and `execute_code`, where the model
  writes one script that calls several tools in a single inference.
- **Six terminal backends**: local, Docker, SSH, Daytona, Modal and Vercel
  Sandbox, the Daytona and Modal ones hibernating when idle.
- **Command approval, container isolation**, MCP servers, voice.
- **Trajectory export** and reinforcement learning with Atropos.
- **Any model endpoint** (Nous Portal, OpenRouter, OpenAI, a local one),
  and a migration that imports an OpenClaw setup.

## 2. What Oppenheimer already has

| Hermes | Here |
|--------|------|
| `SOUL.md`, agent-curated memory, a user model | A bot's SOUL.md and instructions, memory facts with a tier and a scope, *About you*, dreaming (`versions/mvp/25-bots.md` §4.1) |
| Skills, slash commands | `bot_skill`, `use_skill`, `save_skill`, `/<name>` (§4.1, Skills) |
| Cron | Routines and the heartbeat (`versions/mvp/26-bot-routines.md`), automations |
| Subagents | `delegate` (§4.7); on a host, `runner sessions run\|send\|wait` (`next-steps/agent-tools.md`) |
| MCP, a CLI | `apps/mcp`, `opp` (`next-steps/0.6-mcp-cli-and-agent.md`) |
| The gateway | Telegram and WhatsApp built, mail and Slack designed (`next-steps/channels.md`) |
| Command approval | Allow, Ask or Off per tool, approval cards, rules (§5) |
| Search of a session | `search_chat`, for the bot's own chat only |

## 3. What it has that we do not, best fit first

| # | Idea | Where it would land | Taken |
|---|------|---------------------|-------|
| 1 | Skills the agent writes and fixes unasked | §4.1 Skills: save after a hard task, a nudge, `patch_skill` | 2026-11-09 |
| 2 | Search across every past session | §4.2: `search_sessions` over the control plane's session logs | 2026-11-09, logs only |
| 3 | Sandboxes that sleep when idle as a backend | A kind of host beside the runner on your own machine: one interface, several drivers (`10-sleep-wake-and-pricing.md`, `research/sessions-in-microvms.md`) | no |
| 4 | Specialist bots in one group chat, answering when mentioned | `versions/mvp/25-bots.md` §7, "group chats with several bots" | no |
| 5 | Skills in an open format, shared | A library for all of a person's bots (§4.1, "Not built"); `SKILL.md` would let one skill serve a bot, `runner --skill` and the agent in a session | no |
| 6 | Import from another agent | A bot made from an OpenClaw or Hermes setup's SOUL.md, memory and skills | no |
| 7 | Hermes as an agent in a session | An agent kind beside Claude Code and Codex; it takes any model endpoint | no |
| 8 | `execute_code`; a routine's result sent to a channel; Discord | Bulk tool work in one step; routines that report on Telegram or WhatsApp; the cheapest channel after Telegram | no |

## 4. What 25 takes

- **Saving unasked, with a nudge.** A bot saved a skill only when asked.
  It may now save one after work that took many steps and will come again,
  and a turn that has run long without using or saving a skill is reminded
  once. Hermes's nudge is periodic; ours is tied to the turn's steps, since
  a bot's turn is bounded (20 round trips) and a short turn has nothing
  worth saving.
- **`patch_skill`.** Hermes's agent patches a skill in place when a step
  proves wrong. Ours replaces one exact piece of the body, so fixing a step
  does not resend the whole skill. A skill the person wrote last is theirs:
  the bot proposes the change and patches only when asked.
- **`search_sessions`.** Hermes searches its own session store on one
  machine. Ours searches what the control plane holds for every host: a
  session's name, its tasks and prompts, the agent's reports and
  questions. The agent's full conversation stays on its host and is read
  with `read_session_transcript` once the session is found.

## 5. What it does not take

- **A background review after each turn.** Later Hermes versions are said
  to review a turn with a second model call and write the skill there (not
  seen on a fetched page). It costs a call on every long turn; the nudge
  inside the turn is free. Worth another look if bots still save too few.
- **A model's summary of the hits.** The bot that searched is already a
  model reading them.
- **Searching transcripts on hosts.** It needs a search verb on the runner
  and a fan-out over the relay; the control plane's log answers "which
  session was it" first.
- **Trajectory export and RL.** We train no models.
- **The Tool Gateway** (web, image and speech tools behind Nous's portal).
  One vendor for every tool is what `integrate-provider` exists to avoid.
- **20+ platforms.** `next-steps/channels.md` chose a thin adapter per
  channel and depth in each.
- **Honcho.** *About you* and the general memory cover it for now.
