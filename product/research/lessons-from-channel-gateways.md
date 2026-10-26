# Lessons from channel gateways: OpenClaw, Grok Bot, Codex and dots

How four products let an agent be reached over WhatsApp, Slack and email,
read on 2026-10-22 for one question: how do our bots get the same reach?
This note is the read and decides nothing. The design it fed is
[`next-steps/channels.md`](../next-steps/channels.md). Ideas are taken, no
code. Paths in backticks are relative to each source's root unless they
start with a note path.

| Source | What was read |
|---|---|
| OpenClaw | `openclaw/openclaw` at `0e0563a5` (v2026.10.5): `extensions/whatsapp`, `extensions/slack`, `extensions/imap`, the channel plugin SDK under `src/channels/`, the gateway under `src/gateway/` |
| Grok Bot | The 0.75.0 Linux `.deb` from Cursor's download page, its `app.asar` unpacked and read statically: the protobuf schemas in `electron-main/proto.cjs`, the renderer's copy and settings. The loop, the scheduler and the Slack and mail services run on the vendor's servers, so this is what the client shows of them |
| Codex | `openai/codex` at `9a8a85b`: `codex-rs/app-server-protocol`, `codex-rs/connectors`, `codex-mcp`, the cloud-tasks client, the SDKs; the macOS app's `app.asar` (ChatGPT.app 26.1016) read statically; OpenAI's docs for the Slack, Linear and GitHub integrations |
| dots | OpenAI's always-on assistant (DevDay, 2026-09-29), from its docs on `learn.chatgpt.com` and the ChatGPT Slack app's Marketplace listing; no client was read |
| Also | Novu Connect (`novuhq/novu` at `8878b643`) and the Vercel Chat SDK (`chat@4.40.0`), which Novu is built on; Meta's WhatsApp Business Platform terms |

## 1. The one fact worth the read

Every one of them keeps two things apart that are easy to merge:

- **A channel**: where people reach the agent. The agent has an identity
  there (a number, a Slack bot user, an address), and what arrives wakes
  it.
- **A connector**: a tool the agent calls *as its owner* (read my Slack,
  send from my Gmail). It has the owner's identity, not the agent's.

dots says it in its docs: "Messaging your dot in Slack doesn't connect your
inbox", and the two Slack grants are revoked separately. Grok Bot has three
Slack mechanisms (§3) and no two share a token. Codex's connectors are
tools behind one hosted MCP server and its Slack surface is a separate app.
OpenClaw's channels are plugins and its email "channel" is not one at all:
mail is a trigger that starts a read-only run.

The second fact: in all four, **the transport is a thin adapter and the
core owns everything else** — who may talk, which conversation a message
belongs to, durability, debouncing, approvals, the untrusted envelope.

## 2. OpenClaw: one gateway process, a plugin per channel

**Process.** One always-on Node process, the Gateway, holds every channel
connection (the WhatsApp socket, Slack Socket Mode, IMAP IDLE) and runs the
agent loop in it. It serves one WebSocket and HTTP port to its own clients
and runs as a launchd or systemd service, one per state directory.

**The contract.** Every channel is `extensions/<id>` exporting one
`ChannelPlugin` (`src/channels/plugins/types.plugin.ts`): metadata,
capabilities and account config, plus about twenty-five optional adapters.
The ones that matter:

| Adapter | What it answers |
|---|---|
| `capabilities` | chat types, threads, reactions, edits, media, polls, voice |
| `config` | the accounts: list, resolve, enabled, configured, linked |
| `gateway` | `startAccount(ctx)`, long-running until its abort signal fires; QR login start and wait; logout; status snapshots through `ctx.setStatus` |
| `outbound` | `textChunkLimit`, the markdown dialect, `sendText`, `sendMedia`, `resolveTarget` |
| `security` / `pairing` | the DM policy and allowlist; how an approved sender is stored |
| `groups` | whether a mention is required |
| `messaging` | which session an outbound message belongs to |
| `status` | probe, audit, the health snapshot |

The core hands each plugin a runtime with the access check, a durable
ingress queue, the pairing store, the debouncer, dedupe, routing and media
storage. The plugin's job is to turn a native event into one flat,
channel-neutral `MsgContext` (body, sender, conversation, thread, quote,
media, was-mentioned, command-authorized) and to send what comes back.

**WhatsApp** (`extensions/whatsapp`):

- **Baileys only**: the WhatsApp Web multi-device protocol, the gateway as
  a linked device of a phone. No Cloud API. Login is a QR code
  (`connection.update.qr`), shown in the console, valid three minutes.
  The docs recommend a separate number.
- **Auth state is a directory of files** per account (Baileys'
  `useMultiFileAuthState`), written atomically with a `.bak`, behind a
  cross-process lock so two processes never open one linked device.
- **Reconnects** back off 2 s to 30 s; a watchdog closes a socket whose
  frames or messages have gone silent. Status 401 means logged out: the
  state is cleared and the number must be linked again.
- **Inbound**: each message is written to a durable per-account queue
  first (key: a hash of chat and message id), then normalized (status and
  broadcast dropped, its own echoes dropped), checked for access, enriched
  (media up to 50 MB, voice notes transcribed), debounced per
  conversation, routed, and dispatched. A message arriving while a run is
  active steers it by default.
- **Groups need a mention**; unmentioned messages are kept (fifty) and
  given as context the next time it is mentioned.
- **Outbound**: 4,000-character chunks, markdown converted to WhatsApp's
  `*bold* _italic_ ~strike~`, voice notes as push-to-talk audio, typing
  presence while a run lasts. **No send rate limit**; the ban mitigations
  are structural: a dedicated number, never "online", no history sync, no
  replies to old messages.

**Who may talk.** A DM from an unknown sender gets an eight-character
pairing code (one hour, three pending at most) and is dropped; the owner
approves it from the console or CLI. Groups are an allowlist. Being
allowed to talk does not make someone an owner: commands are owner-only.
Untrusted metadata (quotes, contact cards) goes in a fenced block labelled
"not instructions".

**Slack** uses Bolt with three transports: Socket Mode (the default,
because it is self-hosted and needs no public URL), the HTTP Events API
(stateless, behind a load balancer) and a relay. A thread is its own
session. A mention arrives twice (`message` and `app_mention`), so a 24-hour
dedupe on team, channel and timestamp catches the twin. Slash commands are
acknowledged within three seconds; writes are never retried, so nothing is
posted twice.

**Email** is not a chat channel. The IMAP plugin (imapflow, IDLE or
polling) checks the sender's DMARC, SPF and DKIM with mailauth, matches an
allowlist, and starts one isolated, read-only run per message with the mail
wrapped as untrusted. There is no SMTP and no reply threading in the code;
sending is a skill the agent calls.

## 3. Grok Bot: an identity per bot, the owner's tokens per person

Slack is **three systems**, and each uses a different app or token:

| | What it is for | Whose app or token |
|---|---|---|
| Chat | People DM or @mention a bot | **A Slack app per bot**, created in the customer's workspace from a versioned manifest by a stored "manager" authorization, then installed with its own OAuth. Each bot is a real Slack bot user (`app_id`, `bot_user_id`), in one workspace |
| Trigger | A routine wakes on a mention, keyword, message or reaction | Cursor's shared Slack app, plus the person's Slack account linked to theirs |
| Tools | The bot reads or posts as you | Your own OAuth to Slack's hosted MCP server |

- A Slack DM and a Slack thread are each **a session of the bot**
  (`SLACK_DM`, `SLACK_THREAD`), beside its main chat. The model is told the
  thread, the channel's name, purpose and topic, who sent it and whether
  the bot was addressed directly.
- A team bot takes DMs and mentions from anyone in the workspace; a
  personal bot listens in channels but answers only in your DM.
- An out-of-date manifest is a state ("This Slack app is out of date"),
  fixed by a reinstall; admin approval is a state, with a link to Slack's
  request page.

**Email**: each person claims one address, `username@mail.grokbot.com`
(ten behind a flag), and assigns it to a bot; the address never changes.
Mail **wakes a bot only through a routine**, with "require an authenticated
sender" on by default and no allowlist visible. The bot searches and reads
its threads (message id, in-reply-to, direction, attachments, whether the
sender is the owner) and **sends from its own address with approval**,
through Amazon SES with bounce, complaint and new-recipient limits. Your own
Gmail is a separate connector, Google's hosted Gmail MCP.

**Sends are drafts first.** Slack and email messages to someone else are a
draft card by default; the person presses Send. Per-tool permissions
(always, ask, blocked), an admin "connector writes need approval" switch
and an LLM auto-review sit on top. In a shared space, a team bot uses each
person's connector only for that person's messages, after a grant.

**Other channels.** iMessage and SMS through the user's own Mac (it reads
`chat.db` and sends through a helper app), with allowed recipients; phone
calls. WhatsApp and Telegram appear only as logos.

## 4. Codex: a service account finds the work, your account runs it

- **Slack** is now `@ChatGPT` (it was `@Codex`). An admin connects a Slack
  workspace once, as a service account that "does not inherit a person's
  file, app, or private-channel access". Each person links their own
  account the first time, through a link the bot posts. Work runs as a
  cloud task **under the requester's account**; approvals are a private
  Allow and Deny card; only the requester can follow or cancel.
- **Per channel settings** in the desktop app: respond only when
  mentioned or to relevant messages; follow every thread reply or only
  mentions; post replies at once or after the requester reviews them;
  channel instructions.
- **Connectors are one hosted MCP server**, authenticated with the user's
  ChatGPT token; the Slack and Gmail tokens never leave OpenAI. A tool with
  no `destructive` or `open_world` hint is treated as both.
- **Embedding** is `codex app-server` (JSON-RPC): `initialize`,
  `thread/start`, `turn/start`, answer approval requests, read
  `turn/completed`. A host can declare **dynamic tools** that call back into
  it, so a gateway keeps its tokens and still gives the agent tools.
  Outside text enters as `ExternalMessage` with tool-level authority: it
  can start a turn but never approve anything.
- **Automations** fire on a schedule, a heartbeat, a condition, or a
  connector event (Slack channels, a GitHub repository, Gmail).
- There is no WhatsApp and no reply-by-email.

## 5. dots: one agent, a transcript per channel

- One dot per person, reachable in ChatGPT, by in-app call, in Slack and
  (alpha) in Teams; texting "coming soon". **Memory is shared, transcripts
  are per channel**, and the dot asks the owner privately before telling
  one audience what it learned from another.
- **Only the owner directs it.** In Slack, a DM or a mention in a thread
  from its owner starts work; other people's messages are context.
- Its own Slack identity goes through **the one shared ChatGPT app**, whose
  scopes include `chat:write.customize` (post under another name and
  icon), the likely way each dot shows its own name. Grok Bot creates an
  app per bot instead.
- No inbox, no phone number, no WhatsApp. "A draft does not grant
  permission to send it."

## 6. WhatsApp and Meta's terms

OpenAI's ChatGPT number on WhatsApp stopped on 2026-01-15: §4.7 of Meta's
WhatsApp Business Platform terms (last changed 2026-09-23) bars providers
whose AI is the "primary (rather than incidental or ancillary)
functionality" of their use of the **Business Platform** (the Cloud API).
Europe is in flux (a paid reopening in March 2026, an interim order from the
European Commission on 2026-06-09 to restore free access).

OpenClaw's route, a linked device over the WhatsApp Web protocol, is not
the Business Platform at all. It is unofficial: WhatsApp's own terms forbid
unofficial clients, and the risk is the number being banned, which is why
OpenClaw tells people to use a spare one.

## 7. What we take

| Idea | From | Where it lands |
|---|---|---|
| Channel and connector kept apart | dots, Grok Bot, Codex | `channels.md` §1 |
| One small interface per channel; the core owns access, conversations, durability and replies | OpenClaw's `ChannelPlugin`, trimmed | `channels.md` §2 |
| A durable intake row before any work, completed when the turn takes it | OpenClaw's ingress queue | `channels.md` §3, on the inbound-events hub's pattern |
| A conversation per DM, group or thread; memory shared across them | OpenClaw's session keys, Grok Bot's Slack sessions, dots | `channels.md` §4 |
| Owner-only commands; others' words as context; unknown senders held for the owner | OpenClaw, dots, Codex | `channels.md` §5 |
| Groups need a mention; unmentioned lines kept as context | OpenClaw | `channels.md` §5 |
| A draft is not a send; outbound to anyone but the owner asks | Grok Bot, dots | `channels.md` §6 |
| WhatsApp as a linked device of a number you own, QR in the console | OpenClaw | `channels.md` §7.1 |
| One Slack app, a bot's own name and icon per message | dots | `channels.md` §7.2 |
| DMARC before trusting a sender; mail threads by `Message-ID` | OpenClaw, Grok Bot | `channels.md` §7.3 |

## 8. What we do not take

- **A hosted bridge in front of our endpoint** (Novu Connect): a
  third party receiving every message, normalizing it into its own
  subscriber and conversation model, and posting it to us. The owner ruled
  it out on 2026-10-22, and it would put every conversation in another
  company's database.
- **A chat framework owning state** (the Vercel Chat SDK's `Chat`, its
  state adapter and handler model). Its adapters are good transports, but
  it has no Baileys adapter, and its state and queue would sit beside our
  turn queue and Postgres. We take libraries as transports only.
- **The Cloud API for WhatsApp.** It is the official route, but it needs a
  Meta business account and templates outside a 24-hour window, and §4.7
  is aimed at exactly a general-purpose bot. The owner's case is one bot on
  one number they own; the linked device is what OpenClaw proves works.
- **An app per bot in Slack** (Grok Bot), for now: it needs a manager
  authorization, manifest versioning and admin approvals per bot. One app
  with a name per message is the obvious first step.
- **Socket Mode for Slack** (OpenClaw's default): it exists because
  OpenClaw has no public URL. Our API has one.
- **Email as a read-only trigger only** (OpenClaw): a bot that cannot
  answer in the thread it was written in is a notifier, not a channel.
