# Channels — bots on WhatsApp, Slack and email

**Goal:** a bot is reachable where people already are. You write to it on
WhatsApp, mention it in Slack or email it, and it answers there, with the
same memory, tools and permissions it has in the console.

The research is
[`../research/lessons-from-channel-gateways.md`](../research/lessons-from-channel-gateways.md)
(OpenClaw, Grok Bot, Codex and dots, read on 2026-10-22). The owner set the
direction the same day; it is under "Decided" at the end. Version not set;
0.4 Slack becomes the Slack channel of this design. Which bot answers, and
bots that talk to customers, are [Customers and routes](customers-and-routes.md),
which replaces the one bot per account of this note with routes (2026-10-24).

## 1. A channel is not a connector

| | Channel | Connector |
|---|---|---|
| What it is | Where people reach a bot | A tool a bot calls as its owner |
| Whose identity | The bot's: a number, a Slack bot user, an address | The owner's: my Slack, my Gmail |
| What it does | Wakes the bot; the bot answers there | Reads or writes in the owner's account, inside a turn |
| Example | "Juno, what failed last night?" on WhatsApp | Juno reads #incidents with the owner's Slack token |

This document is channels. Connectors are tools of note 25 §4, held to its
permissions, and come later. A channel never grants a connector: talking to
a bot in Slack does not let it read your Slack.

## 2. One interface, one implementation per channel

The `channels` module in `apps/api` owns everything that is the same for
every channel. A channel is a class implementing one port, and a library
does its transport where one does the job. The shape is OpenClaw's
`ChannelPlugin`, trimmed to what we need.

```ts
// channels/application/channel.port.ts
interface ChannelBase<TConfig, TSecret> {
  readonly kind: ChannelKind; // 'whatsapp' | 'slack' | 'email'

  /** How an account is connected: a QR to scan, an OAuth install, a form. */
  readonly link: ChannelLink<TConfig, TSecret>;

  /** Pure: the bot's markdown as this channel's messages, split at its limit, in its dialect. */
  render(markdown: string): string[];

  send(account: ChannelAccountRef<TConfig, TSecret>, message: ChannelOutbound): Promise<ChannelSentRef>;
  /** A channel with no typing indicator or reactions resolves at once. */
  typing(account: ChannelAccountRef<TConfig, TSecret>, to: ChannelAddress, on: boolean): Promise<void>;
  react(account: ChannelAccountRef<TConfig, TSecret>, to: ChannelMessageRef, emoji: string): Promise<void>;

  status(account: ChannelAccountRef<TConfig, TSecret>): Promise<ChannelHealth>;
}

/**
 * Messages are handed to us: Slack's signed events, or the frames a host's
 * runner sends over its link (WhatsApp, §7.1).
 */
export interface PushedChannel<TConfig, TSecret> extends ChannelBase<TConfig, TSecret> {
  readonly transport: 'pushed';
  /** Verifies the delivery (signature, or the host's link), then parses. */
  receive(delivery: ChannelDelivery): Promise<ChannelInbound[]>;
}

/** We fetch, in short calls from a repeating job (IMAP, §7.3). */
export interface PolledChannel<TConfig, TSecret> extends ChannelBase<TConfig, TSecret> {
  readonly transport: 'polled';
  /** One short session: what arrived after the cursor, and the new cursor. */
  poll(account: ChannelAccountRef<TConfig, TSecret>, cursor: string | null): Promise<{ inbound: ChannelInbound[]; cursor: string }>;
}

export type ChannelPort<TConfig, TSecret> = PushedChannel<TConfig, TSecret> | PolledChannel<TConfig, TSecret>;
```

Every channel produces the same inbound shape, and nothing past the
adapter reads anything else:

```ts
export interface ChannelInbound {
  kind: ChannelKind;
  accountId: string;
  /** Unique per account; the intake row's key. */
  externalId: string;
  conversation: { kind: 'direct' | 'group'; id: string; threadId: string | null };
  sender: { id: string; name: string | null; verified: boolean };
  text: string;
  mentionsBot: boolean;
  quote: { text: string; senderName: string | null } | null;
  media: ChannelMedia[];
  occurredAt: Date;
}
```

The transport is the union's tag, not an optional method: the webhook
route and the runner's link lane dispatch to `transport: 'pushed'`
channels, a repeating job polls each account of a `transport: 'polled'`
one, and neither checks whether a method exists. **No long-lived
connection lives in the API**: a socket that must stay open is held by a
runner on the owner's host (§7.1), so the API keeps the one process model
it has.

The core never asks a channel what it can do. Everything that varies by
channel is the adapter's to decide, as data it produces or a pure function
it supplies: the split and the dialect are `render`; whether the bot was
mentioned is `mentionsBot` on the inbound; whether a sender is who they
say (Slack's signed user, a passing DMARC, the phone's own number) is
`sender.verified`. A channel without typing or reactions implements them
as nothing. There are no capability flags to switch on.

The core around the port (§3 to §6) owns intake, conversations, access,
the turn, the reply, approvals and limits, so a fourth channel is a class,
a row in the console's list and its library.

What is not done: a hosted bridge in front of us, or a chat framework that
owns state (the research's §8). Libraries are transports; Postgres and the
bot's turn queue stay the record.

## 3. From message to turn

```
 WhatsApp (runner)┐                       ┌─ owner or allowed? ─ no ─► held for the owner (§5)
 IMAP poll ───────┼─► channel_inbound ────┤
 Slack webhook ───┘   (unique per account │  yes
                       and externalId)    ▼
                                    conversation (§4) ─► bot_turn (origin 'channel', delayed)
                                                                          │
                                                       turn ends ─► port.render ─► port.send
```

The turn is the one unit of work; there is no queue of the channels' own.

- **Intake first.** A message is a `channel_inbound` row before anything
  else, unique on `(accountId, externalId)`, so a reconnect that replays a
  message, or Slack's twin `message` and `app_mention`, is one row. This is
  the inbound-events hub's rule: store what was authenticated before
  anything acts on it. The same transaction queues the turn.
- **Debounce is the turn's start.** The turn queues through the same
  `enqueueWithin` a console message uses, with `bot_turn."origin" =
  'channel'` and `sourceKey = channel-inbound:<id>` of the message that
  opened it, held until a short delay after the last message. A new
  message whose conversation already has a turn queued and not started
  pushes that turn's start back instead of queuing another, so three messages typed in a row are one turn, which reads every
  inbound row of its conversation it has not answered. One turn at a time
  per bot stays true; a message while the bot works waits its turn.
- **The reply is the turn's last step.** The worker renders the final text
  with `port.render` and sends it before the turn ends; each sent part is
  recorded with its id on the turn, so a retried turn sends only what is
  missing.
- **Typing** shows while the turn runs.

## 4. Conversations

A bot has its console chat today (note 25 §3). A channel adds
**conversations beside it**, one per WhatsApp chat, Slack DM or thread, or
email thread:

- `channel_conversation`: account, conversation kind and id, thread id,
  the bot. Its key is `(accountId, conversationId, threadId)`.
- **The console chat is a conversation too**: `bot_conversation` holds one
  row per bot of kind `console`, created with the bot (and backfilled for
  bots that exist), and one per channel conversation, which
  `channel_conversation` points at. `bot_turn` and `bot_message` gain a
  **non-null** `conversationId`, so history is always "this conversation's
  messages" and nothing branches on console against channel. What the bot
  **remembers** (`bot_memory_fact`) and its documents are shared by every
  conversation, as dots does.
- The console shows a bot's conversations under its chat, read-only to
  begin with, with the channel's icon and the other side's name.
- The bot is told where it is: a line of the turn context names the
  channel, the conversation and who is writing, beside the time.

## 5. Who may talk to a bot

- **The owner** is known on each channel: their own WhatsApp number, their
  Slack user (linked once), their email address with a passing DMARC.
  The owner's messages are instructions.
- **Allowed contacts** are a list per account. The default list is the
  owner alone. A contact's message starts a turn; what they ask is theirs,
  but the bot still acts as its owner, inside the owner's permissions.
- **Anyone else** is held: no reply, nothing reaches the bot, and the
  console shows "+34 6… wants to talk to Juno" with Allow and Ignore. A
  reply to a stranger from your own number is the riskiest thing a linked
  device can do, so the default stays silent.
- **Groups and channels need a mention** (Slack mention, the bot's name on
  WhatsApp, a reply to the bot). Unmentioned lines are kept, up to fifty,
  and handed to the next turn as context.
- **Everything from outside is untrusted except the instruction itself.**
  Quotes, forwarded text, thread history, other people's lines and an
  email's quoted chain reach the bot inside `<untrusted_external_data>`,
  with note 16's preamble. Nothing from a channel can approve anything.

## 6. Sending and approvals

- **Answering in the conversation it was asked in** needs no approval: it
  is the reply.
- **Writing anywhere else** — a new chat, another person, another channel
  — is a tool, `send_message`, which **asks** by default (note 25 §5). A
  draft never grants a send.
- **A Needs input card** stays in the console. The channel gets one line to
  the owner only: "Waiting for your approval: <link>". Native buttons
  (Slack's blocks) come later.
- **Limits.** Each send goes through `UpstreamLimiter.exchange`
  (`.agents/rules/integrations.md`): Slack's per-method tiers; for
  WhatsApp a budget of our own, since a linked device has no published
  limit and the cost of going over is the number.

## 7. The three channels

### 7.1 WhatsApp: a linked device of a number you own, held on your host

OpenClaw's route — the owner's spare number is a WhatsApp account on a
phone, and we join it as a linked device, like WhatsApp Web — with the
socket held where a session's terminal is: **by the runner on a host the
owner chose**, not by the API.

- **Library:** whatsmeow, the Go implementation of the WhatsApp Web
  multi-device protocol (mautrix-whatsapp's), in the runner. OpenClaw uses
  Baileys, its TypeScript twin; the protocol and the linked device are the
  same.
- **Link:** Settings → Channels → WhatsApp asks which host holds it. The
  API asks that runner, over its link, to start pairing; the QR comes back
  the same way and the console shows it while it is valid. Scanning it
  from the phone's Linked devices finishes the link.
- **The keys stay on the host,** in the runner's state directory, readable
  by the runner's user only; the API never sees them. Unlinking from the
  console asks the runner to log the device out and delete them.
- **One holder** is the runner itself: one account, one host, one socket.
  Moving it to another host is unlink and link again.
- **Inbound:** the runner turns each message into the `ChannelInbound`
  shape and sends it as a frame on a `channels` lane of its link; the API's
  WhatsApp adapter (`transport: 'pushed'`) writes the intake row and
  acknowledges, and the runner keeps a small outbox of unacknowledged
  frames on disk, so a dropped link loses nothing.
- **Outbound:** `send` asks the runner over the link and waits for the
  sent message's id. While the host is offline the reply part stays unsent
  on the turn and goes when the host returns; Settings shows the account
  as *host offline*.
- **Reconnect** to WhatsApp with backoff and a silence watchdog, in the
  runner. Logged out marks the account *unlinked* in Settings instead of
  retrying.
- **Behaviour that keeps a number safe:** never shown as online, no history
  sync, no reply to messages from before the link or from long ago, read
  receipts off by default, the send budget of §6.
- **Media:** text first. Images go to the bot as images (note 25 §3.1);
  voice notes are transcribed through voice's provider list; documents
  wait.
- **The cost:** the bot answers on WhatsApp only while that host is up. A
  host that sleeps (later versions) wakes for nothing on WhatsApp's behalf.
- **The risk is written down:** an unofficial client can get a number
  banned. That is why it is a number you can lose, not your main one.

### 7.2 Slack: one Oppenheimer app, installed per workspace

- **One app,** installed into a Slack workspace with OAuth ("Add to
  Slack"), events over HTTP to `POST /v1/channels/slack/events`, verified by
  Slack's signing secret. No Socket Mode: the API has a public URL.
- **A bot's own name and icon** on every message (`chat:write.customize`),
  so the account can serve the bot it is bound to under that bot's name.
- **Library:** `@slack/web-api` for calls; the signature check is a few
  lines on the raw body.
- **Conversations:** a DM, or a thread in a channel the app was invited to.
  A mention at the top level starts a thread and answers in it.
- **Slack's own rules:** answer the event within three seconds and do the
  work from the job; drop the duplicate `app_mention`; never retry a
  `chat.postMessage` blindly.
- **The owner's Slack user** is linked by a link the bot sends the first
  time an unknown Slack user who is a member of the workspace writes, if
  they are the bot's owner in Oppenheimer.

### 7.3 Email: a mailbox you own

The same shape as WhatsApp: you connect an account you own, the bot reads
and answers from it.

- **Link:** host, port, user and password (an app password) for IMAP and
  SMTP, tested on save. Stored encrypted.
- **Libraries:** imapflow, in short sessions: a repeating job per account
  (every minute) logs in, fetches what arrived after the stored UID, and
  logs out. No IDLE connection is held. Then mailparser, mailauth (DMARC,
  SPF, DKIM) and nodemailer, which `@oppenheimer/backend-email` already
  uses.
- **Inbound** starts at the end of the mailbox, never on old mail. Plain
  text only; HTML is reduced to text, links are not followed.
- **Trust:** a sender counts as the owner or a contact only with a passing
  DMARC for their address. Anything else is held (§5).
- **Threads:** a conversation is the `References` chain; a reply carries
  `In-Reply-To` and `References`, and the subject with `Re:`.
- **Replies** are plain text with the bot's name as the sender name.

## 8. Where things live

- **API module `channels`.** `channel_account` (workspace, bot, kind,
  config, encrypted secret, status), `channel_contact`, `channel_inbound`,
  `channel_conversation`; the `ChannelPort` and its registry, contributed
  the way `InboundEventsModule.contributeSources` is. No queue of its own:
  work is the bot's turn. Scopes `channels:read` and
  `channels:write`, the `Channel` policy subject.
- **Each channel** is `channels/infrastructure/<kind>/`, the only code that
  imports its library.
- **No new process.** Slack is a webhook, email a repeating job on the
  existing queue, WhatsApp a lane of the runner's link. The API runs as it
  does today.
- **Runner:** `internal/channels/whatsapp` holds the socket, the keys and
  the outbox; the link gains a `channels` lane (`../versions/mvp/01-protocol.md`
  owns its frames). The runner's arch test keeps whatsmeow inside that
  package.
- **bots-chat** owns the turn and the conversation: `bot_conversation`,
  `origin 'channel'`, the delayed start, the reply as the turn's last step,
  `send_message`.
- **Console:** Settings → Channels per bot (link, status, contacts,
  waiting senders), the conversations under the bot's chat.

## 9. Slices

1. **The core and WhatsApp.** The module, the port, intake, conversations,
   the owner-only rule, the reply; the runner's WhatsApp package and the
   link's `channels` lane, with QR linking from the console: the owner's
   number, held on their host, reaches one bot.
2. **Contacts and groups.** Allowed contacts, held senders, groups with a
   mention.
3. **Email.**
4. **Slack**, which is 0.4.
5. **`send_message`**, and channels as routine triggers (note 26): a
   message to a bot's number can also fire a routine.

## Open questions

1. One bot per channel account, or several bots behind one number or app,
   chosen by name? This design binds an account to one bot. *Answered
   2026-10-24 by routes: several bots behind one account, chosen per
   customer and channel ([`customers-and-routes.md`](customers-and-routes.md) §3).*
2. Does the console chat show channel conversations in one timeline, or
   each on its own?

## Decided

- 2026-10-22: WhatsApp the way OpenClaw does it: a linked device of a
  number the owner has, over the WhatsApp Web protocol. The owner will
  connect a spare number. Email and Slack take the obvious route.
- 2026-10-22: one interface every channel implements; a library does a
  channel's transport where one does the job.
- 2026-10-22: no hosted bridge or Novu-style layer between the channels
  and us.
- 2026-10-22, in review: the WhatsApp socket lives on the owner's host, in
  the runner (whatsmeow), and the keys never leave it; the API holds no
  long-lived connection, so email is polled in short sessions. The port is
  a union tagged by transport (`pushed`, `polled`), with no optional
  methods and no capability flags. The console chat is a conversation like
  the others, and a channel's work is the bot's turn, with no queue of its
  own.
- 2026-10-24: an account no longer binds one bot: routes choose the bot
  per channel, account, customer and conversation, and an account's
  audience can be its customers, who are admitted and routed instead of
  held (`customers-and-routes.md`). §5 stays the rule for an account whose
  audience is the owner.
