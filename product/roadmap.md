# Roadmap

The order of what comes after the MVP, as the owner set it on 2026-09-26
and changed since ([`decisions.md`](decisions.md), "The roadmap"). Every
entry has a note in [`design/`](design/README.md), which says what of it is
built; many were built ahead of their version, and an entry with no version
was added after the order was set.

| Version | Document | Theme |
|---------|----------|-------|
| 0.1 | [`design/`](design/README.md) | The MVP: hosts you own, sessions as worktrees with a tmux terminal, Claude Code first |
| 0.2 | [Git and GitHub](design/pull-requests/git-and-github.md), [Pull requests](design/pull-requests/pull-requests.md) | Git, aka GitHub support: diff, review, commit, push and PRs from the console; a Pull requests area in the rail with a queue and analytics |
| 0.3 | — | Kanban moved into the MVP as Plan ([`design/plan/plan.md`](design/plan/plan.md)) | Plan: a task board with goals, tasks that start or link sessions, and a calendar beside Google Calendar |
| 0.4 | [Slack](design/channels/slack-sessions.md) | The Slack integration; now the Slack channel of [Channels](design/channels/channels.md) |
| 0.5 | [Mobile](design/clients/mobile.md) | Mobile |
| 0.6 | [MCP, CLI and agent](design/clients/mcp-cli-and-agent.md) | An MCP server, a CLI and an agent over the same API |
| 0.7 | [Terminal and chat display](design/sessions/terminal-and-chat.md), [The chat's model and protocol](design/sessions/chat-protocol.md) | Improve the terminal, and a chat display beside it; one item model and stream for both chats |
| — | [Multi-account](design/sessions/multi-account.md) | Several agent accounts per person (`archive/multi-account.md`); on the list, version not set |
| — | [Mail](design/channels/mail.md) | Bots work your own Gmail accounts, several per person: search, attachments, drafts, sends (always approved), labels and archive, new mail as a routine trigger; the first version, ahead of channels; version not set |
| — | [WhatsApp](design/channels/whatsapp.md) | Bots read your own WhatsApp number's chats and write in them, OpenClaw's linked device held by the runner on your host; built 2026-10-30, version not set |
| — | [Telegram](design/channels/telegram.md) | Bots read and answer the chats of a Telegram bot you made with @BotFather, OpenClaw's Bot API route long-polled by the runner on your host, the token kept there; built 2026-11-08, version not set |
| — | [Answering on Telegram and WhatsApp](design/channels/answering-on-telegram-and-whatsapp.md) | Your bots answer there: a Telegram bot per Oppenheimer bot, a default bot and routes on a WhatsApp number, the owner recorded by a `start` link or their personal number, strangers held, a contact's or group's turn narrowed; proposed 2026-11-09, version not set |
| — | [Slack for bots](design/channels/slack-for-bots.md) | Ask a bot from Slack, with a mention or in its DM: an app of the bot's own made from a manifest, the owner's Slack user only, answers in the thread; built 2026-11-20, version not set |
| — | [Channels](design/channels/channels.md) | Bots on email, WhatsApp and Slack: one interface per channel, email first as an address of the bot's own; version not set |
| — | [Customers and routes](design/channels/customers-and-routes.md) | Bots that talk to customers: routes pick the bot per channel, account, customer and conversation, a bot of a customer's own, hand-off to a person; after channels, version not set |
| — | [Voice](design/console/voice.md) | Wispr-Flow-style dictation in the console, and setting up a session by speaking it; version not set |
| — | [Agent tools](design/sessions/agent-tools.md) | An agent in a session reaches the person: sends a file to the chat, notifies the Inbox, is woken by its pull request or at a time it set; started 2026-11-02, version not set |
| — | [Cloud agents](design/sessions/cloud-agents.md) | Sessions in the vendors' clouds (Claude `--cloud`, Codex cloud, Cursor Cloud Agents) beside sessions on hosts, and brought back onto a host; version not set |
| — | [Hidden sessions](design/sessions/hidden-sessions.md) | Sessions kept out of the sidebar until shown: a bot, `opp` or MCP can start one hidden, the person hides or shows one from its menu, Show hidden sessions in the filter menu; proposed 2026-11-10, version not set |
| — | [Sentry](design/automations/sentry.md) | Errors from the API, workers, bots and console reported to Sentry; a Sentry issue as an automation trigger that starts a fix; built from 2026-11-02, version not set |

## What this list does not place yet

The MVP notes name VMs (with sleep tiers), the accounts model and Codex
as "the slices after" (`design/foundations/scope.md`, `brief.html`). The
accounts model is on this list as multi-account, but it has no version
yet. VMs and Codex are not on the list at all. Nothing is cancelled;
where these land is the first open question below.

## Open questions

1. Which version gets multi-account, and where do VMs and sleep tiers
   and the host settings drawer land relative to 0.2 to 0.7?
2. Is each version a release with a version number the runner and the
   console both carry, or a product milestone only? The runner already
   ships signed, versioned releases (`design/runner/runner-install-and-update.md`).
3. What is each version's demo scene, the way `design/foundations/scope.md`
   has one for the MVP?
