# @oppenheimer/backend-agents

## 0.1.0

### Minor Changes

- b5aae95: A bot's requests stay cacheable from turn to turn
  (`product/versions/mvp/25-bots.md` §2). A bot on GPT and Grok read 1% of
  its input from the provider's prompt cache.

  - `@oppenheimer/backend-agents`: `BotTurnRequest.cacheKey`, a stable id for
    the conversation a turn continues. The OpenAI engine sends it as the
    request's `prompt_cache_key`, so OpenAI, ChatGPT's backend and xAI send a
    turn's steps and the next turn to the server that holds the prefix.
  - `@oppenheimer/backend-agents`: `BotCompletionRequest` takes `cacheKey` too.
  - `@oppenheimer/api`: a turn names its bot as its cache key, a subagent its
    turn and place (`<turn>:subagent:<n>`), and a call outside a turn its bot
    and purpose (`<bot>:summary`, `<bot>:goal_review`, `<bot>:rule_review`).
    A turn's history loses the oldest messages a block of about 6,000 tokens
    at a time, cut from the oldest forward, so it starts where the last
    turn's did until a whole block no longer fits, instead of losing one
    message every turn.

- 4faf606: A bot's chat shows the subagents of a running `delegate` call as they work.
  The bot's stream sends a `subagents` frame (each child's task, state, the
  tools it has called, its start and duration) each time one moves, keyed by
  the call's id, which the engines now hand each tool call
  (`BotEngineToolCall`). The console hangs a line per child under "Running 3
  subagents", with its clock or how it ended and a fold listing its tools,
  until the stored step replaces them. `useBotLiveText` is now `useBotLive`,
  returning `{ text, subagents }`.
- 7f18bbe: A bot turn that Claude Code ended because its context filled up (autocompact
  thrashing, the window's hard limit, a prompt still too long after compacting)
  no longer reads as "Anthropic refused this request … change the message or
  the model". It fails as the new kind `context`, and the chat says the context
  filled up, that the provider refused nothing, and to have the bot read less
  at once or split the request.
- 8fc6c25: `/usage`, the second built-in command for bots: a card of what the chat has
  spent, in tokens (`product/versions/mvp/25-bots.md` §4.1).

  - `@oppenheimer/backend-agents`: the `usage` event carries `cacheReadTokens`
    and `cacheWriteTokens` (Anthropic's cache reads and writes, the Responses
    API's cached tokens), part of `inputTokens`; `BotEngine.completeWithUsage`
    answers a completion's text with what it spent.
  - `@oppenheimer/api`: a turn keeps its cache reads and writes; the calls a
    bot makes outside its turns (goal reviews, summaries, rule reviews) are
    recorded in `bot_model_call` (`AddBotUsage`) by `BotCompletionResolver`;
    `GET /bots/:id/usage` sums a chat's turns by model and its other calls by
    purpose; clearing the chat clears both. `/usage` is refused as a message.
  - `@oppenheimer/shared`: `usage` joins `BOT_BUILT_IN_COMMANDS` (a reserved
    skill name); `isBotConsoleCommand`; the `BotUsage` types and
    `BOT_MODEL_CALL_PURPOSES`.
  - `@oppenheimer/frontend-consumer`: `useSuspenseBotUsage`.
  - `@oppenheimer/frontend-web`: `formatTokens` is exported.
  - `@oppenheimer/web`: `/usage` in the `/` menu puts the usage card in the
    chat, below its last message: three lines of turns, time at work, tokens,
    cache hit rate, the tokens' split, each model's share and the calls
    outside its turns, with Copy and Close.
  - `@oppenheimer/translations`: `bots.chat.usage.*` and
    `bots.chat.slash.builtIn.usage`.
  - `@oppenheimer/api-client`: `findBotUsage`.

- 201ee3a: A bot's chat queues what you write while it works and shows the room it has
  left. Each waiting message sits over the composer with Remove, Edit and Send
  now. The engines report the context of a turn's last answer (with the
  model's window on the Claude engine) and, on a ChatGPT sign-in, the plan's
  5-hour and weekly windows from the Codex usage headers; each turn keeps them
  (`contextTokens`, `contextWindow`, `planLimits`) and the composer's meter,
  now the platform kit's `ChatUsage` shared with the session chat, reads the
  newest.
- ac929fa: Bots on a ChatGPT subscription (`product/versions/mvp/25-bots.md` §2): a fourth
  provider, `chatgpt`, signed in rather than given a key, the way OpenClaw and the
  Codex CLI do it.

  - Settings → Model providers has a ChatGPT row with Connect ChatGPT: OpenAI's
    device code flow, a one-time code typed on OpenAI's page, polled until the
    person approves it (`POST /v1/model-providers/chatgpt/login` and
    `…/login/poll`). The sign-in's tokens are sealed like a key.
  - `ChatgptBotEngine`, the OpenAI engine with ChatGPT's Codex backend as its
    endpoint: the account header, `store: false` and encrypted reasoning.
  - The worker refreshes the token before a turn when it is about to lapse, one
    refresh per workspace at a time, written only over the tokens it read; a
    refresh ChatGPT refuses removes the sign-in.
  - New problems `BOTS_017`–`BOTS_021`; `PUT /model-providers/chatgpt` answers
    `BOTS_017`.

- 8f93026: New package: the engines a bot's turn runs on (`product/versions/mvp/25-bots.md`
  §2, slice 2).

  - One `BotEngine` port and `createBotEngine()`, which routes by provider:
    `anthropic` and `glm` (z.ai's Anthropic-compatible endpoint) on the Claude
    Agent SDK, `openai` on the OpenAI Agents SDK.
  - One event stream for both: text deltas and blocks, tool steps under our
    tool names, usage, and exactly one `done` (`completed`, `cancelled`,
    `max_steps` or `failed`). It never throws; an abort cancels at once and
    kills the Claude subprocess; no error carries the API key.
  - The Claude engine runs without its shell and file tools, with our tools
    served in process over MCP and an environment built from an allowlist, so
    none of the API's own secrets reach it.
  - Keys are passed per call and never read from the environment.
  - `FakeBotEngine` replays scripted turns, running the tools the script
    calls, for the API's tests.

- 39d9703: Bots: what Grok Bot's harness does that ours did not (`research/lessons-from-grok-bot.md` §9, rows 1–5).

  - A long tool answer keeps its end as well as its start, and says how much of the middle it cut.
  - A turn is told how full its context was when the last one ended.
  - A reply commits to something, and asking again for work under way reports where it stands.
  - A failed turn records what kind of failure it was (`bot_turn.failure`); the chat says whether sending it again can help, offers Retry only when it can, and points a refused key at Model providers.
  - `search_chat` searches a bot's own past messages, including what only its summary holds.
  - The live line says when the turn waits on a provider that refused a call, and an ended turn says how long it worked.

- 59809f9: Bots read images (`product/versions/mvp/25-bots.md` §3.1, issue #426).

  - `@oppenheimer/shared`: `BOT_IMAGE_MIME_TYPES`, `BOT_IMAGE_MAX_BYTES`,
    `BOT_MESSAGE_IMAGES_MAX`, `BotAttachment`, `botTakesImages` and the
    provider catalog's `images`; `sendBotMessageSchema` takes `attachmentIds`
    and a message of images alone; the `bot-attachment-retention` queue.
  - `@oppenheimer/api`: `POST /v1/bots/:id/attachments` (an image judged by its
    bytes) and `GET /v1/bots/:id/attachments/:attachmentId/content`; a message
    claims its images in the send's transaction and carries them in the chat;
    a turn sends its own message's images to the engine; the `bot_attachment`
    table and a daily sweep of images no message carries. Errors
    `BOTS_024`–`BOTS_028`.
  - `@oppenheimer/backend-agents`: `BotTurnRequest.images`, sent as image
    blocks to the Claude engine and `input_image` parts to the OpenAI one.
  - `@oppenheimer/backend-storage`: `StorageService.download`.
  - `@oppenheimer/api-client`: the upload and read operations.
  - `@oppenheimer/frontend-consumer`: `useUploadBotImage`, `useBotImage`, and
    a message's `attachments`.
  - `@oppenheimer/design-system-web`: `ChatImage` and `ChatImageRemove`;
    `ChatComposer` takes `onAttach`, `attachments` and `allowEmpty`;
    `ChatUserMessage` with no words draws its attachments alone.
  - `@oppenheimer/web`: the bot composer picks, pastes and takes dropped
    images, and the chat draws them above your message.
  - `@oppenheimer/translations`: `bots.chat.images.*` and
    `errors.byCode.BOTS_024`–`BOTS_028`.

- f09b6b3: Bots: a session a bot starts is one click away in its chat.

  - `@oppenheimer/backend-agents`: a tool's result may carry `data`, what the
    call made, which the model never reads; `tool.finished` hands it back. The
    Claude engine matches it to its call by Claude Code's `claudecode/toolUseId`,
    the OpenAI engine by the SDK's call id.
  - `@oppenheimer/shared`: `sessionId` on `BotMessageEvent`.
  - `@oppenheimer/api`: `start_session` says which session it started as data,
    not only in words. The tool step keeps it (`sessionId` on a step), and an
    approved call keeps it on the approval (`bot_approval."sessionId"`, migration
    `AddBotApprovalSession`) and on the event that reports the yes.
  - `@oppenheimer/api-client`: `sessionId` on `BotToolStepResponseDto` and
    `BotMessageEventResponseDto`.
  - `@oppenheimer/frontend-consumer`: `sessionId` on `BotToolStep`.
  - `@oppenheimer/design-system-web`: an `action` slot on `TraceStep` (at the
    end of the line, outside the fold's trigger) and on `TranscriptDivider`
    (after the label).
  - `@oppenheimer/web-showcase`: both slots in the chat demos.
  - `@oppenheimer/web`: a small Open session button, opening the session in a
    new tab, on the step of the call that started it and on the approval line.
  - `@oppenheimer/translations`: `bots.chat.openSession`.

- 629ea1d: A bot's work has no fixed length: a turn has no step or time limit, a goal
  no limit of continuations, and what stops one that goes wrong is
  compaction, a guard or a pause (`product/research/lessons-from-long-running-agents.md`).

  - `@oppenheimer/backend-agents`: `maxSteps` absent means no limit (it was
    25). Every engine compacts mid-turn past `compactionThreshold` (70% of
    `min(contextWindow, 128,000)`): Claude Code through its own settings, the
    OpenAI engines through `TurnCompactor` on the Agents SDK's
    `callModelInputFilter`. New request fields `contextWindow` and
    `compaction`; a new `compacted` event. `ToolLoopGuard` runs in `runTool`
    on every turn: an identical call that failed 3 times in a row, or that
    answered the same thing 10 times, is refused, its data carrying
    `LOOP_GUARD_DATA_KEY`.
  - `@oppenheimer/shared`: `BOT_TURN_IDLE_LIMIT_MS`; turn failures `stalled`
    and `loop`; `BOT_GOAL_PAUSE_REASONS`, `BOT_GOAL_IDLE_TURNS`,
    `BOT_GOAL_TOKEN_BUDGET_MIN`; goal activities `paused` and `resumed`;
    `BotGoal.limit` nullable, with `tokensUsed`, `tokenBudget` and `paused`;
    `/goal resume`. `BOT_GOAL_CONTINUATIONS_*` are gone.
  - `@oppenheimer/api`: no `BOT_TURN_MAX_STEPS` or `BOT_TURN_TIME_LIMIT_MS`;
    a turn fails `stalled` after 5 minutes of a silent model while no tool
    runs, and `loop` after 5 refused calls. Goals have no limit, the reviewer
    checks the bot's `end_goal` claim only, and a goal pauses (blocked, a
    provider limit, 3 turns with no tool, a spent budget, a failed or stopped
    turn) instead of ending. `POST /v1/bots/:id/goal/resume`. Migration
    `UnboundBotGoalsAndTurns`.
  - `@oppenheimer/api-client`: `resumeBotGoal`, `BotGoalPausedResponseDto`,
    and the goal's new fields.
  - `@oppenheimer/frontend-consumer`: `useResumeBotGoal`.
  - `@oppenheimer/web`: the goal banner says why a goal paused, with Resume;
    goal lines for `paused` and `resumed`; `/goal resume`.
  - `@oppenheimer/translations`: failure copy for `stalled` and `loop`; the
    goal's pause reasons, Resume and its lines.

- 33cb1d8: Grok as a bot model provider (`product/versions/mvp/25-bots.md` §2).

  - `@oppenheimer/shared`: `xai` in `BOT_PROVIDERS`, after OpenAI and before GLM
    in `BOT_PROVIDER_PREFERENCE`, with Grok 4.7 (effort low to extra high) and
    Grok Build 0.1 (no effort) in its catalog row.
  - `@oppenheimer/backend-agents`: `XaiBotEngine`, the OpenAI engine pointed at
    xAI's Responses API (`api.x.ai/v1`).
  - `@oppenheimer/api`: `xai` in the provider checks of `bot`, `bot_turn` and
    `model_provider_credential`; its key is stored like OpenAI's.
  - `@oppenheimer/web`: Grok's row in Settings → Model providers, drawn with
    Grok Build's mark in the model button.

- baf4c2c: One rate-limit type for both model stacks.

  - `@oppenheimer/backend-llm`: `LlmRateLimitError`, the `rate_limited`
    `LlmError` with `resetAt: Date | null`. `LlmError.resetAt` is gone (read it
    from the subclass), and `LlmError.provider`, `LlmService.provider` and
    `LlmCompletion.provider` are plain strings so a bot provider fits.
  - `@oppenheimer/backend-agents`: `BotEngine.complete` throws
    `LlmRateLimitError` where it threw `BotRateLimitError`, which is removed.
    `engineLlm(engine, binding)` puts a bot engine's completion behind
    `LlmService`.
  - `@oppenheimer/api`: voice's polish runs on one `LlmService` whichever stack
    answers (`POLISH_LLM`); the bot-summaries worker delays a job on
    `LlmRateLimitError`. No behaviour changes.

- 2e5879e: Observability for the bots, the cache and the logs. The API exports `bot_engine_*` metrics for every bot turn and completion (runs by how they ended, failures by kind, tokens with the prompt cache's share, duration, tool calls, retries) and `cache_reads_total` for the Redis cache (hits, misses, errors by namespace), with a Grafana dashboard and alerts for both. `LOG_FILE` also writes the API's log lines as JSON to a file, which `pnpm monitoring:up` now ships to Loki through Grafana Alloy, and `pnpm logs` queries with LogQL. `@oppenheimer/backend-cache` takes an `onRead` observer; `@oppenheimer/backend-core`'s logging takes a `file`.

### Patch Changes

- b1aaefe: A bot's tool answer cut through an emoji no longer fails the turn on Grok. Cutting by length could leave half of an emoji (a lone surrogate). The SDK sent that half as a `\uD83D` escape, and xAI's API rejected the whole request with a 400 ("unexpected end of hex escape"). Tool cuts (`cut`, the web page and transcript limits) now keep whole characters, and `runTool` replaces any lone half with U+FFFD before the model reads it. A 400 that says the provider could not parse the request is now an `other` failure, not `refused`, so the chat no longer tells the person to change their message or model.
- aa1dc94: A ChatGPT subscription turn no longer fails when the Codex backend nests an
  object in its usage's input token details (`cache_write_tokens_details`).
  The OpenAI Agents SDK moves to 0.21, whose usage schema accepts it; the
  turn still counts the cached tokens from `cached_tokens`.
- a88acd2: A ChatGPT turn whose response ChatGPT's backend failed because it was
  overloaded (`response.failed` with code `server_is_overloaded`) fails as
  `unavailable`, not `other`: the chat says the provider could not be reached and
  to try again, and the turn is no longer reported to the error tracker as ours to
  fix.
- 9ceba54: A bot signed in with ChatGPT no longer shows its weekly limit at 0% when ChatGPT sends an empty placeholder for it (0% used, no length, no reset); the row is left out, as the Codex CLI does. The 5-hour and weekly windows are told apart by their length rather than by which header carried them.
- 0287bff: An OpenAI turn whose stream OpenAI opened and then failed on its side (an
  `error` event, or a `response.failed` response, saying `server_error`: "An
  error occurred while processing your request") fails as `unavailable`, not
  `other`. The chat says OpenAI could not be reached and to try again, and the
  turn is no longer reported to the error tracker as ours to fix. A
  `response.failed` turn also shows OpenAI's own words instead of the SDK's
  "unsuccessful terminal state".
- Updated dependencies [baf4c2c]
  - @oppenheimer/backend-llm@0.3.0
