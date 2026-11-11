# Bot first chat eval

Does a new bot's first reply do what Getting started asks?

While a bot's `INSTRUCTIONS.md` is empty its prompt carries Getting started
(`gettingStarted` in `apps/api/src/bots-chat/domain/bot-prompt.policy.ts`,
`product/versions/mvp/25-bots.md` §1):

- work the first message asks for comes first, and the same reply still
  asks what to call the bot and what one job it should own;
- otherwise it greets the person, says its first name is only the one it
  was given, and asks what to call it, never picking a name itself;
- it lists what it can do for them only for areas whose acting tools its
  turn offers (`AREA_INTROS`), and offers to help connect what they need;
- its job examples come from the same table, so a bot that cannot start
  sessions never suggests running coding agents.

A change to Getting started, `AREA_INTROS` or the default soul
(`botSoulFor`) is what this eval is for.

## The cases

`cases.json` holds Juno, a new bot, two sets of tools (`full`: sessions,
Gmail, WhatsApp and routines; `read-only`: `list_hosts` alone) and 5
messages:

| Case | Message | A right run |
| --- | --- | --- |
| `hola-es` | "hola!" | in Spanish: asks its name and its job, lists what it can do |
| `hi-en` | "hi" | the same, in English |
| `work-first` | "What hosts do I have paired?" | calls `list_hosts`, answers, then asks its name and its job |
| `read-only` | "hey" | asks its name and its job, promises no sessions and suggests no coding agents |
| `person-facts` | "Soy Jordi, founder… háblame de tú. ¿Qué hosts tengo?", to a bot that already has a job | answers, and saves who Jordi is to the general memory |

`read-only` and `work-first` are the two that failed on 2026-11-10 and
2026-11-11; add a case whenever a first chat goes wrong.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-first-chat                    # every case, 3 runs each
pnpm eval:bot-first-chat --case read-only   # one case
pnpm eval:bot-first-chat --runs 5
```

Each run builds the bot's real system prompt and soul, serves the case's
tools as stubs (`list_hosts` answers that no host is paired) and sends the
message. A grader on the same model then answers true or false to each
question the case lists in `want`; calls in `wantCalls` must have been made,
and `wantGeneralMemory` needs a `remember` with `memory: "general"`. A case
passes when it is right on most of its runs, and the eval exits 1 when any
case fails.

The model is `BOT_FIRST_CHAT_EVAL_MODEL` (default `claude-sonnet-5-5`), over
the transport the other bot evals share (`../bot-turn.ts`): the Messages API
with `ANTHROPIC_API_KEY`, else the machine's Claude Code login. Every run's
reply, calls and grades go to `reports/` (ignored by git).

## Results

| Date | Model | Runs right | Notes |
| --- | --- | --- | --- |
| 2026-11-11 | claude-sonnet-5-5 | 11/15 | before: `read-only` invented coding-session jobs to reach "two or three examples"; `work-first` skipped the name and job once |
| 2026-11-11 | claude-sonnet-5-5 | 15/15 | job examples from the offered tools only, "suggest no job your tools cannot do", and the work-first reply always ends with the two questions |
