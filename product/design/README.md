# Design

How Oppenheimer works, one folder per area. It began as the MVP's design
(0.1, scoped in [`foundations/scope.md`](foundations/scope.md)) and
grew past it: most of what was once "next steps" is built and lives here
beside the MVP's notes. What is not built yet is in
[`../roadmap.md`](../roadmap.md); what changed along the way is
[`../decisions.md`](../decisions.md).

Each note opens with what is decided and the questions still open, and says
what is built. A note is cited by its path, relative to the note citing it,
with `§` for a section: [`runner/runner.md`](runner/runner.md) §6.

## Foundations

The scope, the wire, the control plane, auth, the API's shape and the security bar every area is held to.

| Document | Covers |
|----------|--------|
| [Scope](foundations/scope.md) | The exact feature list, in and out, and the demo scene it must satisfy |
| [Protocol](foundations/protocol.md) | **The wire**: the two sockets and their two shapes, frame layout and the attachment id, hello, heartbeat, hints, the command list, and which calls are HTTPS instead |
| [Control plane](foundations/control-plane.md) | Data model, API, relay, GitHub App, token minting, and the runner-facing surfaces: register, host JWTs, the link's server half, release rollout |
| [Guest image](foundations/guest-image.md) | Deferred with the VM slice; kept for later |
| [Step-one spike](foundations/step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| [Security checklist](foundations/security-checklist.md) | The findings from `../archive/security-review.md` that the MVP must satisfy, as a checklist |
| [Auth](foundations/auth.md) | Identity, the personal workspace, host ownership, session attach; one page instead of the starter's kernel design |
| [API: modules and data model](foundations/api-modules-and-data-model.md) | The module boundaries, the aggregates, the schema, the on-disk layout and the endpoint surface |
| [API implementation plan](foundations/api-implementation-plan.md) | The order the API is built in, slice by slice |

## Runner and hosts

The Go agent on each host: install and update, what it reports, and the direct path between browser and host.

| Document | Covers |
|----------|--------|
| [Runner](runner/runner.md) | The Go binary: process shape, subcommands, package map, the link, sessions, tmux, streaming, credentials, screen manifests, state, failure modes |
| [Runner install and update](runner/runner-install-and-update.md) | The install command, the agent prompt, pairing, the user service, signed releases, self-update and rollback |
| [Hosts in Settings](runner/hosts-settings.md) | The 2026-09-26 Settings frame read against `hosts/`: status and running count, what removing a host stops, the pairing poll, the CPU count |
| [Host metadata](runner/host-metadata.md) | Where a host's facts live, split by how often they change: inventory, presence, networks, events; access patterns, retention, measured cost |
| [The direct terminal path](runner/direct-terminal-path.md) | Keystroke latency measured in the browser and predictive local echo; a WebRTC data channel from browser to runner with the relay as the path it starts on and falls back to, behind `terminal_direct_path`; authorization stays the relay's |
| [Peer to peer first, and the host proof](runner/peer-to-peer-and-the-host-proof.md) | What still crosses the control plane and the order it moves to the browser ↔ host path; the host signs both DTLS fingerprints and the browser's nonce with its pairing key on every direct channel, and the browser pins the key per host (trust on first use), so a control plane that rewrites the signalling cannot sit in the middle; next: the pin on screen, shares direct, end to end on the relay, device keys |

## Sessions

Where a session runs, how it is shared and previewed, and what an agent in it can reach.

| Document | Covers |
|----------|--------|
| [Sharing a session](sessions/session-share-links.md) | One share per session at one address, `/s/<slug>`: named people or anyone signed in; view, or write for named people for 24 hours at most; acts as whoever shared it; read-only held by the relay and tmux (links of 2026-10-08 superseded) |
| [Where a session runs](sessions/session-places.md) | Two places on a host (the runner's home `~/.oppenheimer/`, the work folder `~/oppenheimer/`), the work folder as `<account>/<workspace>/{repos, agents, sessions}` named by ids, and three ways to start: a new worktree, a folder on the host, a blank terminal in either |
| [Session previews](sessions/session-previews.md) | The session pane's Browser tab: a session's dev server on an origin per session and port under a preview domain, served by the relay through the runner's link (the tunnel already open), judged as an attach by ticket then cookie, the app seeing `localhost`; an app with an API through its dev server's proxy; the ports a session's own processes listen on; why not Cloudflare Tunnel or ngrok |
| [Cloud agents](sessions/cloud-agents.md) | Sessions in the vendors' clouds (Claude `--cloud`, Codex cloud, Cursor Cloud Agents) beside sessions on hosts, and brought back onto a host |
| [Hidden sessions](sessions/hidden-sessions.md) | Sessions kept out of the sidebar until shown: a bot, `opp` or MCP can start one hidden, the person hides or shows one from its menu, Show hidden sessions in the filter menu; proposed 2026-11-10 |
| [Multi-account](sessions/multi-account.md) | Several agent accounts per person (`../archive/multi-account.md`) |
| [Agent tools](sessions/agent-tools.md) | An agent in a session reaches the person: sends a file to the chat, notifies the Inbox, is woken by its pull request or at a time it set; started 2026-11-02 |
| [Terminal and chat display](sessions/terminal-and-chat.md) | Improve the terminal, and show a session as a chat as well as a terminal |
| [The chat's model and protocol](sessions/chat-protocol.md) | One item model and stream for both chats, in six slices drawn from a read of Codex and Grok |

## Console

The screens around the sessions: the sidebar and session view, the Inbox, tabs, the side pane, voice.

| Document | Covers |
|----------|--------|
| [Screens](console/screens.md) | Sign-in, sidebar, Create session, session view, Settings; components and states |
| [Inbox](console/inbox.md) | The 2026-10-25 export's new first rail item, first version: what needs you composed in the console from four reads that exist (sessions waiting on you, bot approvals, pull requests for you, failed runs), one at a time with its answer, filtered by project; done, deprioritize, snooze and delete stored as marks per occurrence; one new read, one new event; questions from Claude Code later |
| [The side pane](console/side-pane.md) | What opens beside a session, one tab each: a shell in its worktree (a tmux window the host lists, so the tabs follow the host), another session on any host, a bot's chat, and the previews; the launcher; what the device keeps and what the host does; a second agent in the same worktree, read in its terminal |
| [Session tabs](console/session-tabs.md) | Open sessions and bots as tabs over Sessions, kept per device; what a tab shows and how closing one moves; the one-line bar; the side pane's launcher as large rows with Side chats; Review decided next; Files, Editor and Source control postponed |
| [Voice](console/voice.md) | Wispr-Flow-style dictation in the console, and setting up a session by speaking it |

## Automations

Runs fired by schedules and events, and errors that start work.

| Document | Covers |
|----------|--------|
| [Automations](automations/automations.md) | The console: what the export draws and what is built — the overview, the runs, an automation's page, the run view and the editor |
| [Automations: the architecture](automations/automations-architecture.md) | How a run is fired, guarded and dispatched: the inbound-events hub, the schedule tick, triggers, revisions, guards, configuration, the data model; and the headless drive that runs take next, in its slices |
| [Sentry](automations/sentry.md) | Errors from the API, workers, bots and console reported to Sentry; a Sentry issue as an automation trigger that starts a fix; built from 2026-11-02 |

## Plan

The task board, milestones and the calendar.

| Document | Covers |
|----------|--------|
| [Plan](plan/plan.md) | The rail's third item: the slices and the owner's decisions; tasks, goals and a calendar beside Google Calendar |
| [Plan: the product](plan/plan-product.md) | What the Plan frames say, screen by screen: the board, the dialogs, tasks that start or link sessions, and the gaps the frames leave |
| [Plan: tasks and goals](plan/plan-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, the attach rule, Queued |
| [Plan: the calendar](plan/plan-calendar.md) | The month view from four reads, personal events, read-only Google Calendar through a port |
| [Plan: milestones, stats and Google accounts](plan/plan-milestones-stats-accounts.md) | The 2026-10-13 Tasks frame read against the built Plan: goals renamed milestones, needs input as a field, a task event log, Stats, several Google accounts, and the contract the Projects agents build on; proposed, with the owner's questions open |

## Pull requests

Git and the Pull requests area. The proposal behind its next lanes is [`../research/reviewing-at-agent-speed.md`](../research/reviewing-at-agent-speed.md).

| Document | Covers |
|----------|--------|
| [Git and GitHub](pull-requests/git-and-github.md) | What a session does to a repository after the agent writes code (see the change, review it, commit, push, open and follow a pull request), from the console |
| [Pull requests: the queue and the numbers](pull-requests/pull-requests.md) | The Pull requests area in the rail: a queue of whose turn it is, saved views and analytics; the screens as built |
| [Pull requests: the API plan](pull-requests/pull-requests-api-plan.md) | How `apps/api` builds what the Pull requests frames draw (2026-10-05, narrowed to the 2026-10-13 export) |
| [Pull requests: design handoff](pull-requests/pull-requests-design-handoff.md) | The brief the design agent drew the Pull requests area's version 1 from: what was settled between 2026-09-27 and 2026-10-05 |

## Bots

The Employees section's bots: the loop and its tools, routines, subscriptions, and bots in the other sections.

| Document | Covers |
|----------|--------|
| [Bots](bots/bots.md) | The Employees section's general bot: its loop in Oppenheimer on the Claude Agent SDK or the OpenAI Agents SDK by provider (Anthropic, GLM, OpenAI), the tool catalog and per-bot permissions, bots that edit themselves, talk to each other and create bots, hosts for the sessions it starts; four slices |
| [Bot routines](bots/bot-routines.md) | How a bot works when nobody writes to it: routines as automations whose run target is a bot (an `AutomationRunTarget` port, session and bot adapters), a routine's run as a queued turn of the bot, "when a session ends" as a trigger source, the heartbeat as a spread schedule with quiet turns; routines made in chat through one `update_routine` tool, a read-only Routines tab and a spend guard, as Grok Bot does; five slices |
| [Bot subscriptions](bots/bot-subscriptions.md) | How a bot hears back from work it delegated: a subscription to a session (at start or later) wakes it with a queued turn when the task needs input, completes, fails or is stopped; thin events re-read as the owner, one wake per task and state, a wake limit; what Grok Bot and OpenAI's webhooks taught; three slices |
| [Bots in the sections](bots/bots-in-sections.md) | A Bots heading in Sessions, Automations, Plan and Pull requests, as the 2026-10-25 export draws it: a bot shows in the sections placed on it (by its owner, the section's plus, or itself), and opens its chat inside Pull requests; three slices |

## Channels

Bots outside the console: mail, WhatsApp, Telegram, Slack, and who answers whom.

| Document | Covers |
|----------|--------|
| [Channels](channels/channels.md) | Bots on email, WhatsApp and Slack: one interface per channel, email first as an address of the bot's own |
| [Mail](channels/mail.md) | Bots work your own Gmail accounts, several per person: search, attachments, drafts, sends (always approved), labels and archive, new mail as a routine trigger; the first version, ahead of channels |
| [WhatsApp](channels/whatsapp.md) | Bots read your own WhatsApp number's chats and write in them, OpenClaw's linked device held by the runner on your host; built 2026-10-30 |
| [Telegram](channels/telegram.md) | Bots read and answer the chats of a Telegram bot you made with @BotFather, OpenClaw's Bot API route long-polled by the runner on your host, the token kept there; built 2026-11-08 |
| [Answering on Telegram and WhatsApp](channels/answering-on-telegram-and-whatsapp.md) | Your bots answer there: a Telegram bot per Oppenheimer bot, a default bot and routes on a WhatsApp number, the owner recorded by a `start` link or their personal number, strangers held, a contact's or group's turn narrowed; proposed 2026-11-09 |
| [Slack for bots](channels/slack-for-bots.md) | Ask a bot from Slack, with a mention or in its DM: an app of the bot's own made from a manifest, the owner's Slack user only, answers in the thread; built 2026-11-20 |
| [Customers and routes](channels/customers-and-routes.md) | Bots that talk to customers: routes pick the bot per channel, account, customer and conversation, a bot of a customer's own, hand-off to a person; after channels |
| [Slack: sessions](channels/slack-sessions.md) | Start and follow sessions from Slack, and hear from one there when it needs someone; a bot in Slack is [Channels](channels/channels.md) §7.2 |

## Clients

Other ways in: the phone, the CLI and the MCP server.

| Document | Covers |
|----------|--------|
| [Mobile](clients/mobile.md) | Follow sessions, answer an agent that is waiting, and review from a phone |
| [MCP, CLI and agent](clients/mcp-cli-and-agent.md) | An MCP server so any agent can use Oppenheimer, a CLI for people and scripts, and an agent of our own on top; what is built |
