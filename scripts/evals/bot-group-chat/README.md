# Bot group chat eval

Does a bot in a WhatsApp group read who each line is for, answer the ones
meant for it, and keep out of the rest?

Since 2026-11-21 every line with words in a group the owner allowed wakes
its bot. On 2026-11-25 the owner wrote "Se lo decia a Adri haha" in a
group, saying their line before was for Adri, and the bot cut in with
"Jaja, perdona, me colé". A group's turn is now told
(`core/turn-context.contact-group-who`) to read the last messages, work out
who the new one is for, answer only what is for it, and otherwise reply
`[silent]`, which `contactReplyOf` sends to no one. The design is
`product/next-steps/answering-on-telegram-and-whatsapp.md` §5 (2026-11-25).

The unit specs prove that a `[silent]` reply reaches no one
(`deliver-channel-reply.command-handler.spec.ts`). This eval proves the half
only a model can: that a bot reading its real prompt tells a line for it
from one between other people.

## How it works

Each case in `cases.json` is a group's last messages and a new line, with
whether the bot should answer it. For each run, the runner builds the
contact turn the way production does:

1. the bot's system prompt with no tools (a contact's turn has none);
2. the contact's turn context, `composeTurnContext` with `contact: 'group'`;
3. the earlier lines as the Claude engine's transcript (`renderTranscript`),
   each person's line fenced as the wake fences it
   (`whatsappContactOpening`), the bot's own as its replies;
4. the new line, fenced the same way.

A run is scored on what production would send the group
(`contactReplyOf`): nothing, or a reply.

## Running it

```bash
pnpm eval:bot-group-chat                                    # every case, 3 runs each
pnpm eval:bot-group-chat --case correction-for-someone-else # one case
pnpm eval:bot-group-chat --runs 5
pnpm eval:bot-group-chat --control                          # without the group line
```

`BOT_GROUP_CHAT_EVAL_MODEL` picks the model (default `claude-sonnet-5-5`).
It passes when every case is right on a majority of its runs. Each run's
reply goes to `reports/`.

Marks: `A` answered, `S` kept out, `a` answered a line that was not for it,
`s` kept out of a line that was, `-` the turn failed.

## Cases

24 cases, 14 where the bot should keep out and 10 where it should answer,
in Spanish, Catalan and English, with four people in the group:

- **Keep out:** the incident's correction ("Se lo decia a Adri haha"), a
  remark about the bot to the others, plans between friends, a question
  for Maria the person, a thanks or a 👍 after the bot's answer, a
  ResetOwl question asked of Jordi by name, a joke about the bot, laughing
  emojis, the group moved on to dinner since the bot last spoke, an open
  question about padel, one person answering another's question, chatter
  in Catalan.
- **Answer:** asked by name (in all three languages, with an `@` too),
  called "bot", greeted by name, a follow-up to what the bot said, the
  answer to the bot's question with other chatter in between, an open
  question only the bot can answer, and someone pointed at the bot with a
  ResetOwl bug (a judgement call: stepping in is its job).

## Results

2026-11-25, `claude-sonnet-5-5` through Claude Code, 3 runs each:

| | Runs right | Cases failed |
| --- | --- | --- |
| `--control` (no group line) | 33/72 | 13/24: every keep-out case |
| with the line | 72/72 | 0/24 |

Without the line the bot answered every line that was not for it, the
incident's included ("Ah, vale, era para Adri 😄"). With it, the one case
that has missed in earlier runs is `remark-about-the-bot` (1 of 3 once:
"Vale, anotado: ahora funciono sobre Oppenheimer 👍").

A case first written as Adrian asking "la Maria del grupo sigue siendo el
bot de openclaw?" and Jordi answering him was answered by the bot 3 of 3
times even with the line: a question about the bot reads to it as a
question to it. It was replaced by the incident's own shape (Jordi's remark
with no question before it).
