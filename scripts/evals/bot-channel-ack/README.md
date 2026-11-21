# Bot channel ack eval

Does a bot on Telegram or WhatsApp answer first, then do the work, then
come back with the result, and answer what the person writes in between?

On 2026-11-20 the owner asked a bot on WhatsApp "Can you check my active
sessions" and heard nothing for two minutes, then got a summary. Since then,
in the owner's own chat:

- what the bot writes before a tool call is sent as the call begins;
- a message sent meanwhile reaches the running turn with its next tool
  result;
- the turn's end sends only what came after its last call.

The design is `product/next-steps/answering-on-telegram-and-whatsapp.md` §4.
The unit and integration specs prove the plumbing. This eval proves the
half only a model can: that a bot, reading its real prompt, writes the
short line first, answers the mid-work question, and still brings the
result.

## How it works

Each case in `cases.json` is one message from the owner on a channel. For
each run, the runner:

1. builds the bot's real system prompt and turn context, with the channel's
   line and `turn/context.as-it-goes`;
2. serves the production host and session tools over the in-memory
   workspace (`../bot-workspace.ts`);
3. runs one real turn;
4. for a case with `steer`, appends the person's mid-work message to the
   result of call `afterCall` with production's own `steerNote`, which is
   how the engine delivers a steer.

**The gateways are mocked.** The turn's events go through the production
chain:

- `TurnTranscript`
- `BotChannelAsItGoesFactory`
- `BotChannelReplyResolver`
- `DeliverChannelReplyCommandHandler`

They end in a stand-in command bus that plays the person's phone. It
records each `ReplyOnTelegramCommand` and `ReplyOnWhatsappCommand` in order,
with how many tool calls had ended when it arrived. The report prints that
phone for every run.

## The cases

| Case | Channel | Wants |
| --- | --- | --- |
| `check-sessions-whatsapp` | WhatsApp | a short line before the first call, then the result |
| `check-sessions-telegram` | Telegram | the same, on the other gateway |
| `blocked-whatsapp` | WhatsApp | the same, worded differently |
| `mid-work-question-whatsapp` | WhatsApp | the same, and "Is the deploy one of them?" sent mid-work is answered |
| `mid-work-question-telegram` | Telegram | the same, with a mid-work question about something else |
| `thanks-whatsapp` | WhatsApp | one reply, no line before it |
| `what-can-you-do-telegram` | Telegram | one reply |

Marks:

- `A`: acknowledged, then the result, with the mid-work question answered
  when there is one.
- `S`: a single reply.
- `a`: no short line before the work, or no result after it.
- `s`: more than one reply when one was due.
- `m`: the mid-work question went unanswered.
- `-`: the phone got nothing.

For the steer cases, the summary also counts how often the mid-work
question was answered in a line of its own before the result, not folded
into it.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-channel-ack                             # every case, 3 runs each
pnpm eval:bot-channel-ack --case thanks-whatsapp      # one case
pnpm eval:bot-channel-ack --control                   # without the as-it-goes line
```

The model is `BOT_CHANNEL_ACK_EVAL_MODEL` (default `claude-sonnet-5-5`). It
runs on the Messages API when `ANTHROPIC_API_KEY` is set, and otherwise on
the machine's Claude Code login. `--control` drops the
`turn/context.as-it-goes` line and keeps everything else, so the difference
between the two runs is that line's effect.

## Results

| Date | Code | Model | Run | Right | Mid-work answered in its own line | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 | this change | claude-sonnet-5-5 | eval | 21/21 | 0/6 | Every task opened with "On it, checking your sessions." (once "Let me check your sessions.") before the first call. The mid-work question was answered every time, folded into the result: on WhatsApp the result came straight after the question; on Telegram the bot made two more lookups to answer it, then answered both at once |
| 2026-11-20 | this change | claude-sonnet-5-5 | `--control` | 6/21 | n/a | Without the as-it-goes line, no task opened with a line: the first message came after the work, as on `main`. The 6 right runs are the two no-tool cases |

On these cases, the as-it-goes line is what makes the bot answer first. A
separate line for a mid-work question shows up only when work still goes on
after it, and none of these cases left more than a lookup or two to do.
