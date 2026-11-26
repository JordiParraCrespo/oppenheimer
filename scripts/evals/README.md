# Evals

An eval runs the real prompt, the real tools and a real model over a set of
cases, and fails when the model no longer does what the code means it to.
Unit tests prove the code; an eval proves the model reads it as intended.

## When one is owed

Every change to something agentic, i.e. what a model is shown or can call,
is run through the evals that cover it before the branch is pushed. The
paths are `CHECKS.evals` in `.agents/hooks/verification.mjs`: the bots
(`apps/api/src/bots-chat/`, `apps/api/src/bots/domain/`), the agent engines
(`packages/backend/agents/`), the LLM package (`packages/backend/llm/`), every
`domain/prompts/` folder, the guide bots read (`packages/shared/src/guide/`), session titles, the voice polish and pull request
briefs. The verification guard (`.agents/hooks/verify-guard.mjs`) refuses
the push until one of these answers the change as it is now:

- **an eval that exits green.** It records itself in `.evals/passed.json`
  (ignored by git) with a fingerprint of the change, so an edit to the code
  afterwards asks again, and an edit to a comment does not. A focused run
  (`--case <id> --runs 1`) counts; run what the change could break.
- **`node scripts/evals/record.mjs --skip "<why>"`**, for a change no eval
  can see (a rename, a mapper, a type). Say the same in the pull request.

`node scripts/evals/record.mjs --status` lists what the branch changes and
whether it is answered.

**A new tool, prompt or rule gets a case first.** Add the case that fails
without the change (the tool is not called, the rule is ignored), see it
fail, then make the change and see it pass. A new behaviour with no eval
that fits gets an eval of its own: copy the closest one here, keep its
`run.ts` on `../bot-turn.ts` (the transport and `writeReport`, which does the
recording), and add a `pnpm eval:<name>` script.

## Which eval covers what

| Change touches | Run |
| --- | --- |
| Memory: `remember`, the memory sections, `bot-memory.policy.ts` | `pnpm eval:bot-memory` |
| Skills: saving, fixing, reading them, `bot-skill-tools.factory.ts` | `pnpm eval:bot-skills`, `pnpm eval:bot-capability-skills` |
| Starting a session: `start_session`, its model, host, repository | `node scripts/evals/bot-session-launch/run.mjs` (its README) |
| Following, searching and unblocking sessions | `pnpm eval:bot-session-follow`, `eval:bot-session-search`, `eval:bot-session-unblock` |
| Check-backs, loops, waiting on async work | `pnpm eval:bot-check-back` |
| A routine's run meeting a blocker | `pnpm eval:bot-blocked-run` |
| Channels (Telegram, WhatsApp): answer first, then the work | `pnpm eval:bot-channel-ack` |
| A WhatsApp group: who a line is for, answering or keeping out (`core/turn-context.contact-group*`, `contactReplyOf`) | `pnpm eval:bot-group-chat` |
| Getting started, a new bot's first reply | `pnpm eval:bot-first-chat` |
| Reactions: `react`, the reaction line of how a turn goes | `pnpm eval:bot-react` |
| The composer's suggested next message | `pnpm eval:bot-suggestion` |
| Approve for me's reviewer: `bot-auto-review.policy.ts`, `core/job-auto-review.md` | `pnpm eval:bot-auto-review` |
| The core system prompt, the toolbox, the agent engines | the bot evals nearest the change, `--runs 1` each; the whole set before a large change |
| Session titles: `session-name.policy.ts`, `prompts/system/title.md` | `pnpm eval:session-title` |
| The voice polish | `node scripts/evals/voice/run.mjs` (needs recorded clips; its README) |

The evals for the agents' own skills (`autoreview`, `frontend-audit`,
`feature-flags`, `pr-screenshots`, `query-keys`) measure this repository's
instructions, not the product, and the guard does not ask for them.

## Running them

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm eval:bot-memory --case name --runs 1
```

A bot eval runs on the Messages API with `ANTHROPIC_API_KEY`, else through
the Claude Agent SDK on the machine's Claude Code login, which works in a
cloud session as it is. Each README says its cases, flags and results so far.
