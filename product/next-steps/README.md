# Next steps

What comes after the MVP, one version at a time. The MVP itself is
[`../versions/mvp/`](../versions/mvp/README.md) and is 0.1. This list is
the owner's order as of 2026-09-26; each version has a document here
that starts as a sketch (the goal, what already exists to build on, the
questions to answer first) and grows into a design the way the MVP
documents did. When a version's design is real enough to need several
documents, it moves to `../versions/<version>/` and the file here points
there.

| Version | Document | Theme |
|---------|----------|-------|
| 0.1 | [`../versions/mvp/`](../versions/mvp/README.md) | The MVP: hosts you own, sessions as worktrees with a tmux terminal, Claude Code first |
| 0.2 | [Git and GitHub](0.2-git-and-github.md), [Pull requests](0.2-pull-requests.md) | Git, aka GitHub support: diff, review, commit, push and PRs from the console; a Pull requests area in the rail with a queue and analytics |
| 0.3 | — | Kanban moved into the MVP as Plan ([`../versions/mvp/17-plan.md`](../versions/mvp/17-plan.md)) | Plan: a task board with goals, tasks that start or link sessions, and a calendar beside Google Calendar |
| 0.4 | [Slack](0.4-slack.md) | The Slack integration; now the Slack channel of [Channels](channels.md) |
| 0.5 | [Mobile](0.5-mobile.md) | Mobile |
| 0.6 | [MCP, CLI and agent](0.6-mcp-cli-and-agent.md) | An MCP server, a CLI and an agent over the same API |
| 0.7 | [Terminal and chat display](0.7-terminal-and-chat.md), [The chat's model and protocol](0.7-chat-protocol.md) | Improve the terminal, and a chat display beside it; one item model and stream for both chats |
| — | [Multi-account](multi-account.md) | Several agent accounts per person (note 06); on the list, version not set |
| — | [Mail](mail.md) | Bots work your own Gmail accounts, several per person: search, attachments, drafts, sends (always approved), labels and archive, new mail as a routine trigger; the first version, ahead of channels; version not set |
| — | [Channels](channels.md) | Bots on email, WhatsApp and Slack: one interface per channel, email first as an address of the bot's own; version not set |
| — | [Customers and routes](customers-and-routes.md) | Bots that talk to customers: routes pick the bot per channel, account, customer and conversation, a bot of a customer's own, hand-off to a person; after channels, version not set |
| — | [Voice](voice.md) | Wispr-Flow-style dictation in the console, and setting up a session by speaking it; version not set |
| — | [Cloud agents](cloud-agents.md) | Sessions in the vendors' clouds (Claude `--cloud`, Codex cloud, Cursor Cloud Agents) beside sessions on hosts, and brought back onto a host; version not set |

## What this list does not place yet

The MVP notes name VMs (with sleep tiers), the accounts model and Codex
as "the slices after" (`../versions/mvp/00-scope.md`, `brief.html`). The
accounts model is on this list as multi-account, but it has no version
yet. VMs and Codex are not on the list at all. Nothing is cancelled;
where these land is the first open question below.

## Open questions

1. Which version gets multi-account, and where do VMs and sleep tiers
   and the host settings drawer land relative to 0.2 to 0.7?
2. Is each version a release with a version number the runner and the
   console both carry, or a product milestone only? The runner already
   ships signed, versioned releases (`../versions/mvp/09-runner-install-and-update.md`).
3. What is each version's demo scene, the way `../versions/mvp/00-scope.md`
   has one for the MVP?

## Decision log

- 2026-09-26: directory created with the order 0.2 Git/GitHub, 0.3
  Kanban, 0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and
  chat display.
- 2026-09-26: multi-account added, version not yet set.
- 2026-09-27: 0.2 gains a second document, the Pull requests area:
  a rail item with a rule-based queue (whose turn it is), saved views
  and analytics, algorithmic first with any agent help later.
- 2026-09-27: the owner set the Pull requests area's first cut to the
  simplest version: a PR list like Codex's plus a keyboard triage that
  always opens the next PR to review. Sections, views and analytics
  stay the direction, after it.
- 2026-09-27: PR classification (type, risk and effort, priority, area)
  is rules first, with TypeSafe's Jev only for what rules cannot read,
  gated by confidence, opt-in per workspace, and never reordering
  triage in 0.2 (`0.2-pull-requests.md` §8).
- 2026-09-28: analytics stays inside the Pull requests area for now
  (`0.2-pull-requests.md` §5); it becomes its own rail item, with PRs as
  one tab, once it covers sessions, agents, hosts or automations.
- 2026-10-05: version 1 of the Pull requests area is the queue with a
  summary on every PR, plus Analytics; lanes, auto-merge and prepared
  review sessions come after. Design handoff:
  `0.2-pull-requests-design-handoff.md`.
- 2026-10-05: the 2026-10-05 evening frames (`PullRequests.dc.html`) are
  the spec for the Pull requests area's first version, over the notes;
  the API plan is `0.2-pull-requests-api-plan.md`.
- 2026-10-14: voice added, version not yet set: dictation into the
  composers and the terminal, and a spoken session setup that fills the
  new-session form (never starts it on its own).
- 2026-10-14: voice has one mic, the composer's, which always dictates.
  Setting up a session from what was said is the sessions module's
  `POST /v1/sessions/proposals`, which takes any text, so the voice
  endpoint stays audio in and text out.
- 2026-10-16: voice transcribes on the workspace's ChatGPT sign-in
  (Settings → Model providers), through ChatGPT's dictation route, with
  an OpenAI-compatible key as the fallback. The route is undocumented;
  if it only answers clients posing as the Codex app, the fallback
  takes over.
- 2026-10-17: voice slice 1 built: dictation into New session's composer.
  The console records WAV itself, the route asks `sessions:write`, and the
  recorder stays in the sessions feature until a second surface needs it
  (`voice.md`, "Slice 1 as built").
- 2026-10-17: voice's providers are one `SpeechProvider` interface and an
  ordered list; the console reads `GET /v1/voice/status` instead of
  deciding availability itself (`voice.md`).
- 2026-10-22: channels added, version not yet set: a bot reachable on
  WhatsApp (a linked device of a number the owner has, as OpenClaw does
  it), Slack and email, each channel one implementation of one interface,
  libraries for the transports, no hosted bridge. 0.4 Slack becomes its
  Slack channel (`channels.md`).
- 2026-10-22, in review: the WhatsApp socket is held by the runner on the
  owner's host, so its keys never leave it and the API holds no long-lived
  connection; email is polled. 0.4 now covers only sessions in Slack.
- 2026-10-22: cloud agents added, version not yet set: a Cloud place for
  sessions in Claude's, Codex's and Cursor's clouds, Cursor through its
  API, Claude and Codex through the runner on a host (`../research/cloud-agents.md`).
- 2026-10-24: customers and routes added after channels.
- 2026-10-29: channels start with email, an address of the bot's own.
- 2026-10-29: mail added ahead of channels: bots work your own Gmail, drafts included, every send approved.
- 2026-10-26: Cursor's cloud agents landed ahead of a version, as a rail
  item of their own on the person's Cursor key ([Cloud agents](cloud-agents.md),
  "What landed"); Claude and Codex cloud keep their place in its order.
- 2026-10-27: Claude cloud built ahead of Cursor, at the owner's request: a
  `cloud` place started by the host's runner with `claude --cloud`, and its
  status reported by `apps/extension` from claude.ai (`cloud-agents.md`,
  `../versions/mvp/24-session-places.md` §7).
- 2026-10-28: both clouds kept, at the owner's request: Claude Code's
  (started by a host) and Cursor's (launched by the control plane, no host)
  are two kinds of the one `cloud` place; Grok's comes after them
  ([Cloud agents](cloud-agents.md), "Two kinds of cloud session").
- 2026-10-31: 0.7 gains a second document, the chat's model and protocol,
  from a read of Codex and Grok (`../research/lessons-from-codex-and-grok-chat.md`):
  one item model for both chats, a stream that loses nothing on reconnect,
  folded exploration and bounded output, approvals as requests, steer and
  rewind, and rendering tests; six slices, each its own pull request.
