# An advisor for the bots, measured

Measured on 2026-11-27 for a bot setting that was built and not shipped:
an **advisor**, Anthropic's advisor tool (`advisor_20260301`), which pairs
the model a turn runs on with a stronger one it may consult mid-turn.
Claude Code turns it on from its `advisorModel` setting. The question was
whether a bot with an advisor gets more right than the same bot without
one, for what it costs. It does not, on any bot work we could measure, so
the advisor stays out of the product: an owner who wants a stronger bot
picks a stronger model.

The build is kept on four unmerged pull requests (#1096 engine and catalog,
#1097 API and `/usage`, #1099 the composer chip, #1100 `update_bot`), should
the question come back.

## 1. What we learned building it

- **It runs through the engine as it is.** One setting, `advisorModel`,
  turns it on for a Claude Code turn. Under our engine's environment
  (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`) Claude Code drops the
  setting behind a feature gate it can no longer fetch;
  `CLAUDE_CODE_ENABLE_EXPERIMENTAL_ADVISOR_TOOL=1` opens it. The variable is
  marked experimental.
- **Its spend is a model of its own.** The run's `usage` counts only the
  turn's model; the advisor's calls come back only in `modelUsage`. One
  Opus 5.5 consultation cost twice the Sonnet 5.5 turn it advised.
- **Only Anthropic models take one**, each from Anthropic's pairing table.
  z.ai's GLM endpoint, OpenAI, ChatGPT and Grok have none.
- **Codex has no equivalent.** Its published binary (0.172.0) has no
  advisor; its "guardian" reviewer approves risky commands, as our Approve
  for me reviewer does. The package ships no evals; its repository could
  not be read (GitHub timed out).

## 2. Claude Code's guidance, and why bots do not follow it

Claude Code adds a section to every turn with an advisor, our bots'
included (a turn under a custom system prompt quoted it word for word):

> Call advisor BEFORE substantive work -- before writing, before
> committing to an interpretation, before building on an assumption. […]
> On tasks longer than a few steps, call advisor at least once before
> committing to an approach and once before declaring done. On short
> reactive tasks where the next action is dictated by tool output you just
> read, you don't need to keep calling.

It is written for coding sessions: its examples are writing files and
committing. A bot's turn reads a tool's answer and acts, which the
guidance calls a short reactive task, so the model does not consult.

## 3. The measurements

All on the Claude Code login, medium effort unless named, through the
eval runner's set-ups (`scripts/evals/bot-turn.ts`: `BOT_EVAL_ADVISOR`,
`BOT_EVAL_EFFORT`, `BOT_EVAL_ADVISOR_NUDGE`; a grading turn is never run
under them). Cost is compared in tokens or as Claude Code reports it; its
dollar figures move with prompt caching.

**Sonnet 5.5**, two judgement evals graded in code, 2 runs a case:

| Set-up | `bot-blocked-run` | `bot-session-unblock` | Advisor consulted |
| --- | --- | --- | --- |
| medium | 20/20 | 18/18 | n/a |
| medium, Opus 5.5 advisor | 19/20 | 18/18 | 1 of 38 runs |
| high | 20/20 | 18/18 | n/a |

and two with headroom, 3 runs a case: `bot-check-back` 21/21, 20/21 with
an advisor, 21/21 at high; `bot-first-chat` 16/18, 16/18 with an advisor,
17/18 at high. The advisor was consulted in none of those 57 runs.

**Haiku 5.5**, where the bot does miss, 2 runs a case:

| Eval | alone | with an Opus 5.5 advisor | nudged | Consulted (offered / nudged) |
| --- | --- | --- | --- | --- |
| `bot-blocked-run` | 20/20 | 20/20 | | never |
| `bot-session-unblock` | 18/18 | 18/18 | | never |
| `bot-check-back` | 10/14 | 8/14 | 11/14 | never / 3 of 14 |
| `bot-first-chat` | 8/12 | 7/12 | | never |
| `bot-merge-train` `hard-train` | 6/8 | 5/8 | 8/8 | never / 8 of 8 |

`bot-merge-train` (`scripts/evals/bot-merge-train/`) was written for this:
the first bot eval of several steps, merging a repository's ready pull
requests in order past traps only reading finds. Sonnet 5.5 alone gets it
right (3/3 of each case), at about $0.05 a `hard-train` run as reported;
Haiku nudged to its advisor at about $0.088.

## 4. What it shows

- **Offered an advisor, a bot does not consult it**: 2 consultations in
  about 230 runs, on Sonnet and on Haiku, where it got the answer right
  and where it did not.
- **Told to consult it** (one line: before an action that changes
  something, call the advisor with the plan), it does, and on the
  multi-step case the advice fixes every miss. On `bot-check-back` it does
  not.
- **Sonnet alone does as well for less.** The case the advisor fixed for
  Haiku, Sonnet gets right on its own, for about 60% of what Haiku with its
  advisor costs as reported (about even at list prices without caching).

The advisor would earn its place only if a cheap model with an advisor beat
a stronger model on cost for the same results on real bot work; nothing
here shows that. `bot-merge-train` and the runner's set-ups stay, to
measure it again on harder cases or new models.
