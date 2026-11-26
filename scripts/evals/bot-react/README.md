# Bot react eval

When a bot reacts to the person's message, does it also write a short line?

On 2026-11-25 a bot answered the owner's "okeys!" with a lone 👍 and no
words. The owner likes the reaction but wants a short message with it. The
prompt then allowed a reaction "instead of [a reply] when the reaction says
it all"; it now says a reaction always comes with a short reply
(`core/system-how-a-turn-goes`, the `react` tool's description in
`core/tools-self`).

## How it works

Each case in `cases.json` is the bot's last message and the person's short
answer to it: an acknowledgement, thanks, good news, a joke. The runner
builds the real system prompt with `react` (its production description and
schema, as a stub) and a few stub mail tools, and runs one turn.

A run is right when its reply has words (a letter or digit). A reaction
alone, or a reply of emoji only, is a miss. Reacting is never required. A
case passes only when every run is right: the reported reply was one lone
emoji, so a single miss fails it, where the other bot evals take a majority.

```bash
pnpm eval:bot-react                       # every case, 3 runs each
pnpm eval:bot-react --case okeys --runs 1
```

`BOT_REACT_EVAL_MODEL` picks the model (default `claude-sonnet-5-5`). Any
Anthropic-compatible endpoint works through `ANTHROPIC_BASE_URL`; GLM on Z.ai,
in a cloud session where the proxy holds the key:

```bash
ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic \
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
BOT_REACT_EVAL_MODEL=glm-5.2 pnpm eval:bot-react --runs 5
```

## Results

| Date | Model | Prompt | Runs right |
| --- | --- | --- | --- |
| 2026-11-25 | claude-sonnet-5-5 | before | 15/15 |
| 2026-11-25 | claude-sonnet-5-5 | after | 15/15 |
| 2026-11-25 | glm-5.2 | before | 25/25 |
| 2026-11-25 | glm-5.2 | after | 25/25 |
| 2026-11-25 | glm-4.6 | before | 14/15, `okeys` fails (a lone emoji) |
| 2026-11-25 | glm-4.6 | after | 15/15 |
| 2026-11-25 | glm-5-turbo | before | 14/15, `thanks` fails (a lone emoji) |
| 2026-11-25 | glm-5-turbo | after | 15/15 |

Sonnet and GLM 5.2 never left a lone emoji, even before the change; the
older GLM 4.6 and GLM 5 Turbo did, once in fifteen runs each, and the new
prompt stopped both. The report came from a bot on GPT-6.2 Sol, which this
eval cannot run without an OpenAI transport.
