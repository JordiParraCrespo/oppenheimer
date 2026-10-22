# Channels — bots on WhatsApp, Slack and email

**Goal:** a bot is reachable where people already are. You write to it on
WhatsApp, mention it in Slack or email it, and it answers there, with the
same memory, tools and permissions it has in the console.

The research is
[`../research/lessons-from-channel-gateways.md`](../research/lessons-from-channel-gateways.md)
(OpenClaw, Grok Bot, Codex and dots, read on 2026-10-22). The owner set the
direction the same day; it is under "Decided" at the end. Version not set;
0.4 Slack becomes the Slack channel of this design.

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
export interface ChannelPort<TConfig, TSecret> {
  readonly kind: ChannelKind; // 'whatsapp' | 'slack' | 'email'
  readonly capabilities: ChannelCapabilities;

  /** How an account is connected: a QR to scan, an OAuth install, a form. */
  readonly link: ChannelLink<TConfig, TSecret>;

  /**
   * Long-lived channels (WhatsApp's socket, IMAP IDLE) run here until the
   * signal aborts, handing each message to `sink`. Webhook channels omit it.
   */
  connect?(account: ChannelAccountRef<TConfig, TSecret>, sink: ChannelInboundSink, signal: AbortSignal): Promise<void>;

  /** Webhook channels (Slack): verify the signature, then parse. */
  receive?(request: ChannelWebhookRequest): Promise<ChannelInbound[]>;

  send(account: ChannelAccountRef<TConfig, TSecret>, message: ChannelOutbound): Promise<ChannelSentRef>;
  typing?(account: ChannelAccountRef<TConfig, TSecret>, to: ChannelAddress, on: boolean): Promise<void>;
  react?(account: ChannelAccountRef<TConfig, TSecret>, to: ChannelMessageRef, emoji: string): Promise<void>;

  status(account: ChannelAccountRef<TConfig, TSecret>): Promise<ChannelHealth>;
}

export interface ChannelCapabilities {
  textLimit: number; // a reply longer than this is split
  dialect: 'whatsapp' | 'slack-mrkdwn' | 'email-html';
  threads: boolean;
  reactions: boolean;
  typing: boolean;
  edits: boolean;
  media: boolean;
}
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

The core around the port (§3 to §6) owns intake, conversations, access,
the turn, the reply, approvals and limits, so a fourth channel is a class,
a row in the console's list and its library.

What is not done: a hosted bridge in front of us, or a chat framework that
owns state (the research's §8). Libraries are transports; Postgres and the
bot's turn queue stay the record.

## 3. From message to turn

```
 WhatsApp socket ─┐                       ┌─ owner or allowed? ─ no ─► held for the owner (§5)
 IMAP IDLE ───────┼─► channel_inbound ────┤
 Slack webhook ───┘   (unique per account │  yes
                       and externalId)    ▼
                                    conversation (§4) ─► debounce ─► bot_turn (origin 'channel')
                                                                          │
                                         channel-replies queue ◄── turn ends
                                                 │
                                         port.send, split by capabilities
```

- **Intake first.** A message is a `channel_inbound` row before anything
  else, unique on `(accountId, externalId)`, so a reconnect that replays a
  message, or Slack's twin `message` and `app_mention`, is one row. This is
  the inbound-events hub's rule: store what was authenticated, then
  process it from a job.
- **Debounce per conversation.** Three messages typed in a row are one
  turn: a delayed job per conversation, pushed back by each new message
  (a short default, per channel).
- **A turn like any other.** It queues through the same `enqueueWithin` a
  console message uses, with `bot_turn."origin" = 'channel'` and
  `sourceKey = channel-inbound:<id>`, so a retried job finds the turn it
  already queued. One turn at a time per bot stays true; a WhatsApp message
  while the bot works waits its turn.
- **The reply** is a `channel-replies` job keyed by the turn, written when
  the turn ends: the bot's final text, split at the channel's limit and
  turned into its dialect. A send is recorded with its sent id; a retry
  that finds one does not send again.
- **Typing** shows while the turn runs, where the channel has it.

## 4. Conversations

A bot has its console chat today (note 25 §3). A channel adds
**conversations beside it**, one per WhatsApp chat, Slack DM or thread, or
email thread:

- `channel_conversation`: account, conversation kind and id, thread id,
  the bot. Its key is `(accountId, conversationId, threadId)`.
- `bot_turn` and `bot_message` gain a nullable `conversationId`; null is
  the console chat. History handed to a turn is that conversation's; what
  the bot **remembers** (`bot_memory_fact`) and its documents are shared
  by every conversation, as dots does.
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

### 7.1 WhatsApp: a linked device of a number you own

OpenClaw's route. The owner's spare number is a WhatsApp account on a
phone; Oppenheimer joins it as a linked device, like WhatsApp Web.

- **Library:** Baileys (`baileys` on npm), the WhatsApp Web multi-device
  protocol, as OpenClaw uses it.
- **Link:** Settings → Channels → WhatsApp shows a QR, streamed while it
  is valid; scanning it from the phone's Linked devices finishes the link.
- **Auth state** is the account's whole identity: Baileys' keys stored in
  Postgres, encrypted like a model provider's key, written one at a time
  per account. Unlinking deletes it and logs the device out.
- **One holder.** A linked device must have exactly one open socket. The
  sockets live in one process (§8), and each account is held under a lease,
  so a second replica or a restart overlap cannot open it twice.
- **Reconnect** with backoff and a silence watchdog. Logged out (401) marks
  the account *unlinked* and says so in Settings, instead of retrying.
- **Behaviour that keeps a number safe:** never shown as online, no history
  sync, no reply to messages from before the link or from long ago, read
  receipts off by default, the send budget of §6.
- **Media:** text first. Images go to the bot as images (note 25 §3.1);
  voice notes are transcribed through voice's provider list; documents
  wait.
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
- **Libraries:** imapflow (IDLE, polling where the server has none),
  mailparser, mailauth (DMARC, SPF, DKIM) and nodemailer, which
  `@oppenheimer/backend-email` already uses.
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
  the way `InboundEventsModule.contributeSources` is; the queues
  `channel-inbound`, `channel-replies`. Scopes `channels:read` and
  `channels:write`, the `Channel` policy subject.
- **Each channel** is `channels/infrastructure/<kind>/`, the only code that
  imports its library.
- **The long-lived connections** (WhatsApp sockets, IMAP IDLE) run in a
  `channel-gateway` role of the API image: the same code, started alone,
  holding a lease per account. In development it runs inside the API
  process. Webhook channels need no gateway.
- **bots-chat** owns the turn: `origin 'channel'`, the conversation on a
  turn, the reply job, `send_message`.
- **Console:** Settings → Channels per bot (link, status, contacts,
  waiting senders), the conversations under the bot's chat.

## 9. Slices

1. **The core and WhatsApp.** The module, the port, intake, conversations,
   the owner-only rule, the reply, and WhatsApp with QR linking: the
   owner's number reaches one bot.
2. **Contacts and groups.** Allowed contacts, held senders, groups with a
   mention.
3. **Email.**
4. **Slack**, which is 0.4.
5. **`send_message`**, and channels as routine triggers (note 26): a
   message to a bot's number can also fire a routine.

## Open questions

1. One bot per channel account, or several bots behind one number or app,
   chosen by name? This design binds an account to one bot.
2. Does the console chat show channel conversations in one timeline, or
   each on its own?
3. Should the WhatsApp link also be offered to run on the owner's host,
   through the runner, so the session's keys never leave their machine?
   Go has a mature WhatsApp Web library (whatsmeow).

## Decided

- 2026-10-22: WhatsApp the way OpenClaw does it: a linked device of a
  number the owner has, over the WhatsApp Web protocol. The owner will
  connect a spare number. Email and Slack take the obvious route.
- 2026-10-22: one interface every channel implements; a library does a
  channel's transport where one does the job.
- 2026-10-22: no hosted bridge or Novu-style layer between the channels
  and us.
