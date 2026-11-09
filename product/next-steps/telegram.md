# Telegram — a bot of yours, read and written by your bots

**Goal:** connect a Telegram bot you made with @BotFather and let your
Oppenheimer bots work it: see who wrote to it, read its chats, and answer
there. "Anything new on the shop bot?", "Tell the group the build is green"
are each one message to a bot.

The owner asked for it on 2026-11-08: "telegram integration for the bots.
Check openclaw. There is already a gateway for whatsapp". So it takes
OpenClaw's Telegram channel (grammY on a BotFather token, long polling by
default, read on 2026-11-08 at docs.openclaw.ai/channels/telegram) and puts
it on the gateway WhatsApp already has: the runner on a host you chose
holds the connection and the secret, the control plane keeps what the bot
sees, and your bots read and send through tools. Slice for slice it is
[WhatsApp](whatsapp.md); where it differs, this note says why.

## 1. What is different from WhatsApp

| | WhatsApp | Telegram |
|---|---|---|
| Whose identity | Yours: a linked device of your number | The bot's: a bot account you created with @BotFather |
| What it sees | Every chat of the number | Only chats with the bot: people who wrote to it, groups it was added to |
| How it is joined | A QR scanned from the phone | The bot's token, pasted once |
| Protocol | Unofficial (WhatsApp Web), a number can be banned | Telegram's official Bot API, over HTTPS |
| Who can start a chat | The bot can write to any number | Only someone who wrote to the bot first: Telegram refuses the rest |

Telegram's user-account API (MTProto, a client acting as you, the way
whatsmeow does) is not the route: OpenClaw does not take it, it needs an
API id per app and a login code, and the Bot API already does what a bot
needs. Reading *your own* Telegram chats would be that route; it is not
this note.

## 2. Connecting a bot

Settings → Telegram lists your bots and offers **Connect a bot**: pick one
of your hosts, name it ("Shop"), and paste the token @BotFather gave you.

- **The token lives on the host,** in the runner's state directory
  (`~/.oppenheimer/state/telegram`, `0700`/`0600`), as WhatsApp's keys do.
  It crosses the control plane once, inside the `telegram.link` frame, and
  is never stored or logged there. The runner checks it with `getMe` before
  keeping it; a token Telegram refuses is `TG_001`.
- **The runner long-polls** `getUpdates`, as OpenClaw does by default: no
  public URL, no webhook, and nothing for the API to hold open. It deletes
  any webhook the bot had (Telegram refuses polling while one is set).
- The control plane asks over the link (`telegram.link`,
  `telegram.unlink`, `telegram.send`) and the runner reports how the bot
  stands (`telegram.state`) and every message it sees
  (`telegram.messages`). The wire is
  `packages/shared/src/protocol/telegram.ts`.
- **One bot per host**, up to three per person, as WhatsApp. A bot polled
  from two places loses updates to whichever asked first, so moving one is
  disconnect and connect again. *Changed 2026-11-09: a Telegram bot belongs
  to one Oppenheimer bot and is polled by that bot's home host, so a host
  polls one token per bot whose home it is
  ([answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md) §1).*
- **Disconnecting** asks the host to forget the token and its outbox, and
  forgets the bot and its messages. The bot itself stays yours on Telegram;
  revoke its token in @BotFather to end it there too.
- A token revoked in @BotFather makes Telegram answer `401`: the account
  shows *Token revoked*, and connecting again with the new token resumes.
- A new token the host refuses for a bot it is already polling changes
  nothing on the host: the account stays *Connected* and says the new token
  did not take.
- `RUNNER_TELEGRAM=off` stops a runner offering it.

**`telegram_account`**: the workspace, the person, the host (unique), the
label, the state as the host last reported it (`connecting`, `connected`,
`revoked`, `unlinked`), the bot's id, `@username` and name, and why it is
revoked.

## 3. How the bot behaves

- **What it hears** is Telegram's, not ours: in a direct chat, everything;
  in a group, only commands, mentions and replies to it while the bot's
  privacy mode is on (the default in @BotFather). Settings says how to turn
  it off for a bot that should read whole groups.
- **No history.** The Bot API has none: the bot sees what arrives from the
  moment it is connected, and the runner drops updates older than ten
  minutes on the first poll (a token reused from somewhere else).
- Channel posts, edits, reactions and service messages (joins, pins) are
  dropped. Text first; media is named, as WhatsApp's is.
- **Sends** are plain text, one message of at most 4,096 characters (the
  Bot API's limit), with no parse mode, so nothing a bot writes is read as
  markup. Telegram's own limits are kept on the host: one message a second
  to a chat, twenty a minute to a group, and a `429`'s `retry_after`
  pauses every send for that long. Telegram allows thirty a second across
  chats; there is no number to lose, so there is no daily host budget.
- **Reconnects** back off from 2 to 30 seconds on network errors; a `401`
  stops it (*Token revoked*).
- **Nothing is lost on a dropped link.** The runner moves the poll's offset
  past a batch only once it is in the on-disk outbox, and keeps each
  message there until the control plane acknowledges it, as WhatsApp's.

## 4. What is kept

Kept as WhatsApp's are (`whatsapp.md` §3), in **`telegram_message`**: one
row per chat and message id (chat, its kind and title, sender, their name
and `@username`, the text or a caption, the media's kind, the message it
replies to, Telegram's time), and what bots sent through it, marked with
the bot. Kept for **90 days** and at most **50,000 per bot**, deleted with
it, intake bounded per runner link the same way. Only the owner's bots read
it; no route returns it.

## 5. The bot's tools

A group of its own in Settings → Permissions, **Telegram**:

| Tool | Does | Default |
|------|------|---------|
| `list_telegram_accounts` | Your connected bots: name, `@username`, state | auto |
| `list_telegram_chats` | A bot's chats, most recent first, with the last message | auto |
| `read_telegram_chat` | One chat by its id or a name, oldest first, up to 100 messages, further back with `before` | auto |
| `search_telegram` | Words across a bot's kept messages | auto |
| `send_telegram_message` | A text to a chat the bot has | ask |

- **What people wrote is untrusted**, inside `<telegram>`, as WhatsApp's
  `<whatsapp>`.
- **A send asks**, and the chat is the call's subject, so "Always allow for
  the shop group" lets the bot answer there without asking again, while
  every other chat still asks (`whatsapp.md` §4). A send allowed without a
  card resolves its chat again on the server.
- A send goes only to a chat the bot has a kept message from: Telegram
  refuses a bot writing first, so there is no "start a chat".
- **Limits:** 200 bot sends per Telegram bot per day, on top of the host's
  pacing (§3).

## 6. Where things live

- **Runner:** `internal/telegram/{domain,app,adapters/botapi}`; the Bot API
  is a few HTTPS calls (`getMe`, `deleteWebhook`, `getUpdates`,
  `sendMessage`) on `net/http`, with no library. `internal/cli/link_telegram.go`
  on the link's lanes. Refusals `TG_001`–`TG_004`.
- **API module `telegram`:** the two tables, `GET/POST /v1/telegram/accounts`
  and `DELETE /v1/telegram/accounts/:id`, the host's reports
  (`RecordTelegramState`, `ReceiveTelegramMessages`, dispatched by the
  relay's `TelegramLinkProcessor`), the send, the reads the tools dispatch,
  reaching the bot through `TELEGRAM_DEVICE`, bound by `links/`. Scopes
  `telegram:read` and `telegram:write`, the `Telegram` policy subject.
  Errors `TELEGRAM_001`–`010`.
- **bots-chat:** `BotTelegramToolsFactory`, the `telegram` tool group.
- **Console:** Settings → Telegram.

## 7. Slices

1. **Connect, see and send** (this note, 2026-11-08): the runner's poller,
   the module, the tools of §5, Settings → Telegram.
2. **Waking on a message**: a `telegram` routine trigger through the
   inbound-events hub, the way WhatsApp's slice 2 is. With slice 1's
   per-chat grant, that is a bot answering people on Telegram by itself.
3. **Telegram as a channel** (`channels.md`): a Telegram bot *is* a bot's
   own identity, so it is the most natural channel of all: people write to
   it, and the Oppenheimer bot it is bound to answers, with the owner-only
   rule and held strangers of `channels.md` §5. Inline buttons for approval
   cards, as OpenClaw's `execApprovals`, belong there. *Designed
   2026-11-09 in
   [answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md),
   which comes before slice 2 and builds no inline approval buttons:
   approvals are answered in the console only.*
4. **Media**: images to the bot, voice notes transcribed.

## Open questions

1. Should the token stay on a host at all? A Telegram bot is not the
   owner's identity and the Bot API needs no socket of ours, so the control
   plane could hold the token encrypted and take updates by webhook, with
   no host to keep up. This note keeps the WhatsApp gateway because the
   owner pointed at it and it works on a local stack with no public URL.
2. Several bots per host? A runner can poll more than one token; one per
   host keeps the account ↔ host rule WhatsApp has. *Answered 2026-11-09:
   yes, one per Oppenheimer bot whose home is that host.*

## Decided

- 2026-11-08: Telegram the way OpenClaw does it, a BotFather bot on the Bot
  API, long-polled; held by the runner on a host as WhatsApp's device is,
  the token kept there; worked by the owner's bots with WhatsApp's tools and
  per-chat send grant. No Telegram library in the runner: the Bot API is
  four HTTPS calls.
- 2026-11-09: the owner's `/start` got no answer, and they asked who
  answers and how the chats are kept safe. A Telegram bot belongs to one
  Oppenheimer bot, polled by its home host; the owner is recorded by a
  one-time `start` link; strangers are held with one fixed line; a
  contact's turn has the customer turn's tools and none of the owner's
  memory ([answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md)).
