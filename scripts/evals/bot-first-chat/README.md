# Bot first chat eval

Does a new bot's first reply do what Getting started asks?

While a bot's `INSTRUCTIONS.md` is empty its prompt carries Getting started
(`gettingStarted` in `apps/api/src/bots-chat/domain/bot-prompt.policy.ts`,
`product/versions/mvp/25-bots.md` §1):

- work the first message asks for is just done, with no name question
  after it;
- otherwise a short, warm welcome (a few sentences, no list) says its first
  name is only the one it came with and asks what to call it, never
  picking a name itself;
- it names what it can do for them only from areas whose acting tools its
  turn offers (`AREA_INTROS`);
- a name that matches one of the person's projects makes its job examples
  about that project, never about one its memory alone mentions;
- its job examples come from the same table, so a bot that cannot start
  sessions never suggests running coding agents.

A change to Getting started, `AREA_INTROS` or the default soul
(`botSoulFor`) is what this eval is for.

## The cases

`cases.json` holds Juno, a new bot, two sets of tools (`full`: sessions,
projects, Gmail, WhatsApp and routines; `read-only`: `list_hosts` alone)
and 6 messages:

| Case | Message | A right run |
| --- | --- | --- |
| `hola-es` | "hola!" | in Spanish, short: asks its name and its job, names what it can do |
| `hi-en` | "hi" | the same, in English |
| `work-first` | "What hosts do I have paired?" | calls `list_hosts` and answers, without asking its name |
| `named-after-project` | "You are Zengue Jewels", with XRP Mobile in the general memory | short, job examples about the ZENGUE JEWELS project, none about XRP Mobile |
| `read-only` | "hey" | asks its name and its job, promises no sessions and suggests no coding agents |
| `person-facts` | "Soy Jordi, founder… háblame de tú. ¿Qué hosts tengo?", to a bot that already has a job | answers, and saves who Jordi is to the general memory |

`read-only` and `work-first` are the two that failed on 2026-11-10 and
2026-11-11, `named-after-project` the owner's on 2026-11-13; add a case whenever a first chat goes wrong.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-first-chat                    # every case, 3 runs each
pnpm eval:bot-first-chat --case read-only   # one case
pnpm eval:bot-first-chat --runs 5
```

Each run builds the bot's real system prompt and soul, serves the case's
tools as stubs (`list_hosts` answers that no host is paired, `list_projects`
four projects) and sends the
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
| 2026-11-13 | claude-sonnet-5-5 | 13/18 | before: `hola-es` ran long; `named-after-project` never tailored its jobs to Zengue Jewels and twice offered XRP Mobile ones |
| 2026-11-13 | claude-sonnet-5-5 | 17/18 | a short warm welcome, no name question after work, `list_projects` before tailoring jobs; the miss is `read-only` once mentioning "your coding work" |
