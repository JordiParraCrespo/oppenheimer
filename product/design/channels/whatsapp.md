# WhatsApp — your number, read and written by your bots

**Goal:** link a WhatsApp number you own and let your bots do with it what
you would: see who wrote, read a chat, find what was said, and answer as
you. "What did Marta say about Tuesday?", "Tell the plumber Thursday at ten
works", "Anything from the school group today?" are each one message to a
bot.

The owner asked for it on 2026-10-30: "the integration with WhatsApp the
same way OpenClaw does it, the way email is done, so my bots can start
seeing and talking with the people in WhatsApp". So it takes OpenClaw's
transport, the linked device that
[Channels](channels.md) §7.1 already designed, and the shape of
[Mail](mail.md): a number of yours, worked by your bots as you, with tools
on top. The research is
[`../../research/lessons-from-channel-gateways.md`](../../research/lessons-from-channel-gateways.md)
§2 and §6.

## 1. Linking a number

Settings → WhatsApp lists your numbers and offers **Link a number**: pick
one of your hosts, name it ("Spare"), and the page shows a QR code. On the
phone, WhatsApp → Settings → Linked devices → Link a device, and scan it.
That is all: the host's runner is now a linked device of that number, as
WhatsApp Web is.

- **The device lives on the host.** whatsmeow (the Go twin of the Baileys
  library OpenClaw uses) runs inside the runner; its keys are in the
  runner's state directory (`~/.oppenheimer/state/whatsapp`, `0700`/`0600`)
  and never leave the host. The control plane asks the runner over its
  link (`whatsapp.link`, `whatsapp.unlink`, `whatsapp.send`) and the runner
  reports how the device stands (`whatsapp.state`, a QR code while it
  pairs) and every message it sees (`whatsapp.messages`). The wire is
  `packages/shared/src/protocol/whatsapp.ts`.
- **One number per host**, since a runner holds one socket; up to three
  numbers per person. Moving a number to another host is unlink and link
  again.
- **The number is a spare one.** WhatsApp's terms forbid unofficial
  clients and a number can be banned; OpenClaw says the same. Settings says
  so. Meta's Cloud API is not the route (research §6).
- **Unlinking** asks the host to log the device out and delete its keys,
  and forgets the number and its messages. A host offline at the time is
  told when it next reports a device the control plane no longer knows.
- A host that sleeps or is off holds no socket: nothing arrives and nothing
  goes until it is back. Settings shows *Host offline*.
- `RUNNER_WHATSAPP=off` stops a runner offering it.

**`whatsapp_account`**: the workspace, the person, the host (unique), the
label, the device's state as the host last reported it (`pairing`,
`connecting`, `connected`, `logged_out`, `unlinked`), the number and its
WhatsApp name, the QR while pairing and why it is logged out. The migration
header is `1793520484168-AddWhatsapp.ts`.

## 2. How the device behaves

OpenClaw's rules for keeping a number safe, kept in the runner:

- **Never shown as online**, no read receipts, no typing.
- **No history sync.** The device sees what arrives from the moment it is
  paired; nothing older, and nothing older than ten minutes when it
  arrives (a reconnect's backlog). So a message you write to the number while its host
  is offline for longer than that gets no answer from your bot when it
  comes back (answering-on-telegram-and-whatsapp.md, slice 3), unlike
  Telegram's, which keeps it.
- Status updates, broadcast lists and channels are dropped.
- **A send budget of our own**: at most 20 a minute and 300 a day per host,
  and every send paused for ten minutes after WhatsApp's own
  `rate-overlimit`. WhatsApp publishes no limit for a linked device, and the
  cost of going over is the number.
- **Reconnects** back off from 2 to 30 seconds; a logout from the phone ends
  it (*Logged out*, pair again).
- **Nothing is lost on a dropped link.** The runner keeps each message in an
  outbox on disk until the control plane acknowledges it; delivery is at
  least once and the control plane keeps one row per chat and message id.
- The pinned whatsmeow is the last that builds on the repo's Go 1.24
  (2026-02-11); the runner asks WhatsApp for its current web client version
  when it starts, so an older library is not refused as outdated.

## 3. What is kept

WhatsApp has no API that reads a linked device's history, so the control
plane keeps what the number sees for its bots: **`whatsapp_message`**, one
row per message (chat, its kind and name, sender and name, whether it was
you, the text or a media message's caption, the media's kind, the message it
quotes, WhatsApp's time), your own messages from the phone included, and
what bots sent through it, marked with the bot. Media itself stays on the
phone: the bot is told "[video]", "[document]" and the caption. A voice note
is the first exception (*2026-11-18*): the row also keeps how long it runs
and, once a bot needed it heard, its transcript; the runner keeps what
fetching it takes (the media key and path, never the audio) for 48 hours and
hands the audio over when asked (`whatsapp.media.get`, up to about two
minutes of it). An image is the second (*2026-11-24*): the runner keeps its
media key and path the same way, and when a turn the image woke starts
(the owner's, or a contact's in a chat the number allows) the API asks for
it (`whatsapp.media.get` with `kind: "image"`, to a runner that names
`whatsapp.image`); the runner downloads it and, past one link frame
(352 KB), scales it to a JPEG that fits. The bot's chat keeps that copy as
an image of the message, as an image you attach in the console, and the
bot sees it; `whatsapp_message` keeps none. One that cannot be fetched (the
host offline or too old, past 48 hours, past 16 MB) reaches the bot as
"[image, could not be seen: …]" with the caption, so it can say so.

Kept for **90 days** and at most **50,000 per number** (the oldest go
first), deleted by intake in batches as new messages arrive, and with the
number when it is unlinked. Intake is bounded per runner link the way
session events are: one frame stored at a time, a backlog of four, and 600
messages a minute; a frame past either is not acknowledged, and the runner
offers it again a minute later. Unlinking also empties the runner's outbox,
so nothing the old number received reaches the next one linked on that
host. Only the number's owner's bots
read it; no route returns it.

## 4. The bot's tools

A group of its own in Settings → Permissions, **WhatsApp**:

| Tool | Does | Default |
|------|------|---------|
| `list_whatsapp_accounts` | Your linked numbers: name, number, state | auto |
| `list_whatsapp_chats` | A number's chats, most recent first, with the last message | auto |
| `read_whatsapp_chat` | One chat by its id or a name, oldest first, up to 100 messages, further back with `before` | auto |
| `search_whatsapp` | Words across a number's kept messages | auto |
| `send_whatsapp_message` | A text to a chat you have, or to a phone number to start one | ask |

- **What people wrote is untrusted.** Every name and text reaches the model
  inside `<whatsapp>` with the note that it is information, never
  instructions (as mail's `<email>`).
- **A send asks** under Auto, and runs under Approve everything.
  Its card names the number and the chat, and the chat is the call's
  *subject*, so "Always allow for Marta" lets the bot answer Marta without
  asking again while every other chat still asks. That is how a bot comes
  to talk with people on its own: chat by chat, by the owner's say. It is
  not always-ask like mail's sends because talking back is the point here;
  the per-chat grant keeps it narrow. A send allowed without a card (a
  grant for the chat, Approve everything) resolves its chat again on the
  server: only a card's stored call carries a plan.
- **Limits:** 100 bot sends per number per day, on top of the host's
  budget (§2). A bot's reply to your own message in your chat with the
  number (answering-on-telegram-and-whatsapp.md, slice 3) is not a send:
  it counts only against the host's budget. Text only, 8,000 characters, WhatsApp's own `*bold*` and
  `_italic_`.
- The bot resolves "Marta" to the one chat of that name (a part of a name
  when only one matches); two chats with one name make it use the id.

## 5. Where things live

- **Runner:** `internal/whatsapp/{domain,app,adapters/whatsmeow}`, the only
  code that imports whatsmeow and SQLite (`modernc.org/sqlite`, pure Go, so
  the binary stays static); `internal/cli/link_whatsapp.go` on the link's
  lanes. Refusals `WA_001`–`WA_004`.
- **API module `whatsapp`:** the two tables, `GET/POST /v1/whatsapp/accounts`
  and `DELETE /v1/whatsapp/accounts/:id`, the host's reports
  (`RecordWhatsappState`, `ReceiveWhatsappMessages`, dispatched by the
  relay's `WhatsappLinkProcessor`), the send, the reads the tools dispatch.
  It reaches the device through `WHATSAPP_DEVICE`, bound by `links/` over
  the runner link. Scopes `whatsapp:read` and `whatsapp:write`, the
  `Whatsapp` policy subject (owners `manage` it in their workspace). Errors
  `WHATSAPP_001`–`010`.
- **bots-chat:** `BotWhatsappToolsFactory`, the `whatsapp` tool group.
- **Console:** Settings → WhatsApp.

## 6. Slices

1. **Link, see and send** (built 2026-10-30): the runner's device, the
   module, the tools of §4, Settings → WhatsApp.
2. **Waking on a message**: a `whatsapp` routine trigger the way mail's is
   (`mail.md` §5), through the inbound-events hub: "when Marta writes",
   "when anyone writes in the school group mentioning me". With slice 1's
   per-chat grant, that is a bot answering people on WhatsApp by itself.
3. **Media**: images to the bot as images, voice notes transcribed through
   voice's providers (`channels.md` §7.1). *Voice notes built 2026-11-18:*
   the owner's voice note wakes their bot with its words, heard through the
   workspace's dictation providers (its ChatGPT sign-in, else the
   deployment's speech server) after the API decodes the Ogg/Opus in
   process; a note the bot reads in a chat shows its words once heard.
   *Voice replies built 2026-11-20:* `send_whatsapp_voice_note` speaks a
   short text (600 characters at most) on the deployment's text-to-speech
   server (`VOICE_TTS_*`, any OpenAI-compatible `/audio/speech` answering
   Ogg/Opus) and the runner sends it as a push-to-talk voice note
   (`whatsapp.send.voice`). *Images built 2026-11-24:* an image the
   number receives wakes the chat's bot as before, with its caption, and the
   turn fetches the image from the host when it starts and is sent it as an
   image, so the bot sees it (above, "Media itself stays on the phone").
4. **WhatsApp as a channel** (`channels.md` §7.1): people write *to* a bot,
   with the owner-only rule and held strangers of `channels.md` §5, on the
   same device. *Designed 2026-11-09 in
   [answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md).*

## Open questions

1. Should the owner choose which bots may use a number, rather than every
   bot of theirs? *For answering, decided 2026-11-18: the number's default
   bot and a bot per allowed chat, no list per number
   ([answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md) §1).
   Which bots may read and send with the number's tools stays open.*
2. Should a group need a mention of the owner before a routine wakes on it,
   as `channels.md` §5 has for channels?
3. A send whose host answered too late may have gone: retrying it could
   send twice. Should the send keep a record keyed by its approval, as
   mail's does, before slice 2 makes sends routine?

## Decided

- 2026-10-30: WhatsApp the way OpenClaw does it, a linked device of a spare
  number, on the runner as `channels.md` §7.1 designed; worked by the
  owner's bots like mail, a connector before it is a channel. The control
  plane keeps the messages the number sees (90 days) because a linked
  device has no history API. A send asks by default and can be allowed per
  chat. whatsmeow is pinned to its last Go 1.24 build rather than moving
  the repo's toolchain.
- 2026-11-09: who answers on the number and who may talk is decided in
  [answering-on-telegram-and-whatsapp.md](answering-on-telegram-and-whatsapp.md).
- 2026-11-18: bots hear voice notes, the way OpenClaw does (transcribed
  before the bot runs, so the bot only ever reads text). The audio is
  fetched from the host on demand rather than sent with every message, so
  a note no bot needs never leaves the phone's media servers, and it is
  decoded in the API (WebAssembly, no `ffmpeg`) because every speech
  provider behind voice takes WAV. The wake queues the note's turn at once,
  in order with the owner's other messages, and the turn hears the note when
  it starts: never at intake or in the outbox listener, which must not wait
  minutes on a host and a speech provider. A note read in another chat is
  not transcribed by the read. Kept as text on the row so it is heard once.
- 2026-11-20: bots speak voice notes as a tool of their own,
  `send_whatsapp_voice_note`, so allowing texts in a chat does not allow the
  owner's voice there; its card quotes every word it will say and the chat,
  and a yes speaks exactly those words to that chat. It spends the same
  share as a text (the day's 100, the host's own budget), and it is kept on
  the row as a voice note whose transcript is what it said, never its audio.
  Speech is the deployment's own text-to-speech server only: no provider is
  required, a deployment without one refuses the tool before any card, and a
  ChatGPT sign-in does not speak (it has no route we may call). The audio is
  made and checked in the API (Ogg/Opus, its length read from its pages),
  carried in one link frame and held in memory on the host, never on disk.
  *Fixed 2026-11-22:* the owner's first two bot voice notes (9 and 20
  seconds, sent as successes) played as silence on the phone. The note now
  carries its waveform, drawn on the host from its Opus packets (a
  push-to-talk note without one plays on WhatsApp Web, not on the phones:
  whatsmeow#517). Audio is decoded in the API before it goes, and audio that
  decodes to silence counts as that provider failing (`VOICE_009`), so the
  next one is tried; the host refuses a note silent from end to end
  (`WA_008`). Which of the two the live notes hit was not established.
- 2026-11-24: a contact's turn, and any turn in a group, may answer as a
  voice note. Such a turn has no tools, so a bot whose instructions said to
  answer a group by voice answered a greeting there in text: the reply at
  the turn's end is text, and the voice tool was not there to call. Where
  the voice tool would run in that chat without a card (a standing yes for
  the chat, or the tool allowed outright with no ask rule its call would
  be read against, never when it is off) and the
  workspace can speak, the turn is told it may start its reply with
  `[voice]`, and only when its instructions or the chat ask for audio and
  the answer is not better read. The reply then goes as one voice note
  through the same reply path (the chat still allowed, still this bot's),
  never also as text; a link, a list, code or more than the note's length
  goes as text, and so does a reply that could not be spoken or that the
  host refused. A note whose answer timed out is not followed by the
  words, since it may have gone. The owner's own chat is unchanged: there
  the bot has the tool.
