# Bot session launch eval

Does a bot start the session the person asked for? A bot once answered
"I can't choose the model when I start a session. Each host uses whatever
its Claude Code is set to." That was true then: `start_session` took no
model. Since 2026-11-10 it takes everything the console's composer offers:
`model` (a catalog id or a name such as "Opus 5.5"), `effort`, `permission`
and `base_branch` (`product/versions/mvp/25-bots.md`, `start_session`).

The unit specs prove the tool does the right thing with those fields
(`apps/api/src/bots-chat/__tests__/bot-session-launch.policy.spec.ts`,
`bot-session-tool.mapper.spec.ts`, `bot-session-tools.factory.spec.ts`).
This eval proves the other half, which only a model can: that a bot,
reading the person's words through its real prompt and tools, passes them.

## How it works

Each case in `cases.json` is one message. The runner, for each:

1. clears the bot's conversation (`DELETE /v1/bots/:id/conversation`);
2. sends the message (`POST /v1/bots/:id/messages`), as the chat does;
3. waits for the turn's `start_session` Needs input card
   (`GET /v1/bots/:id/approvals?status=pending`), or for the turn to end;
4. grades the card, then answers it `stop`, so nothing ever starts.

The card is the server's own reading of the call: the model resolved from
the catalog, the effort, the permission and the branch, in words ("Start
Claude Code (Opus 5.5, high effort) on build-02 in acme/app …"). A case
passes when:

- `card`: the card says each of these;
- `input`: the call carries each field with exactly this value;
- `absent`: the call carries none of these, so nothing the person did not
  ask for (an escalation to full access above all) rides along;
- `refused`: no card was raised (the tool refuses an unknown model before
  one), and the bot's reply names one of `mentions` without claiming the
  model cannot be chosen.

## Running it

You need a running API (`node scripts/stack/stack.mjs up`, or any
deployment), and on it:

- a bot whose model provider has a key, set to **Approve for me**, so
  `start_session` raises a card instead of starting a session. A bot under
  Full access fails every case, by design;
- a project the bot can see with at least one repository, and a home host
  for the bot or a default host on the project (it need not be online: the
  card is raised before anything reaches the host);
- an API token with `bots:write`.

```bash
export BOT_EVAL_TOKEN=…        # an API token with bots:write
export BOT_EVAL_BOT=…          # the bot's id
export BOT_EVAL_PROJECT=…      # the project's name, as the person would say it
node scripts/evals/bot-session-launch/run.mjs
node scripts/evals/bot-session-launch/run.mjs --case model-and-effort
node scripts/evals/bot-session-launch/run.mjs --repeat 3
```

`BOT_EVAL_API` points it elsewhere (default `http://localhost:3000/api`).
The run clears the bot's conversation once per case, so use a bot kept
for evals, not one whose chat you want to keep.

It prints PASS or FAIL per case, with why, and writes everything the bot
did to `reports/` (git-ignored). Run it again with `--repeat` after
changing the bot's prompt (`bots-chat/domain/bot-prompt.policy.ts`) or
`start_session`'s description, and on each provider and model bots run on:
a pass on one model says little about another.

The grader itself is `run.test.mjs`, run by `pnpm ci:local` in the lint job.
