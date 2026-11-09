# Bot memory eval

Does a bot write each fact to the right memory?

A bot has two memories (`product/versions/mvp/25-bots.md` §4.1):

- **its own** (`memory: "yours"`, the default): read by that bot alone. Its
  job goes here: the person's projects, repositories, folders, hosts,
  accounts, schedules, and how they want that kind of work done.
- **the general memory** (`memory: "general"`): about the person, read by
  every bot of theirs. Only what a bot with a completely different job would
  need: their name, role, language, time zone, how to address them, how
  they like to work everywhere.

The rule lives once, in `MEMORY_CHOICE_RULE`
(`apps/api/src/bots-chat/domain/bot-memory.policy.ts`), and reaches the
model through `remember`'s description, its `memory` hint and the prompt's
*Your memory* / *General memory* sections. A change to any of them is what
this eval is for.

## The cases

`cases.json` holds a fact already in the general memory, three bots
(Facturas, a PR reviewer, an XRP Mobile helper) each with a fact of its own,
so the prompt carries both memories' sections, and 20 messages, each holding one fact and the memory it belongs in,
with why. Among them are the three facts that leaked into Facturas' prompt
from other bots on 2026-11-08 (`pr-notifications`, `xrp-project`,
`cloud-sessions`, the last one rightly general). Add a case whenever a bot
files a fact in the wrong memory.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-memory                    # every case, 3 runs each
pnpm eval:bot-memory --case squash      # one case
pnpm eval:bot-memory --runs 5
```

Each run builds the bot's real system prompt (`composeBotSystemPrompt`),
offers the real `remember` tool and sends the message. A run of a general
fact is right when it reached the general memory (a note of the bot's own on
what it means for its job may sit beside it); a run of the bot's own fact is
right when it was saved and nothing reached the general memory. A
case passes when it is right on most of its runs, and the eval exits 1 when
any case fails.

The model is `BOT_MEMORY_EVAL_MODEL` (default `claude-sonnet-5-5`). With
`ANTHROPIC_API_KEY` set it calls the Messages API; without it, it runs each
turn through the Claude Agent SDK on the machine's Claude Code login, with
the tool served the way the Claude bot engine serves it
(`packages/backend/agents/src/claude/claude-tool-server.ts`).

It prints a line per case (`G` general, `Y` yours, `?` a value the tool
refuses, `-` saved nothing, one mark per run), then how many runs leaked a job fact into the general memory and how many
kept a general fact in both memories (right, but worth watching if it
grows),
and writes every save to `reports/` (ignored by git).

## Results

| Date | Wording | Model | Right | Job facts leaked to general |
| --- | --- | --- | --- | --- |
| 2026-11-08 | before (`about: "person"`) | claude-sonnet-5-5 | 75/100 (5 cases fail) | 25 |
| 2026-11-08 | `MEMORY_CHOICE_RULE` | claude-sonnet-5-5 | 100/100 | 0 |

Five runs a case, through the Claude Code login.
