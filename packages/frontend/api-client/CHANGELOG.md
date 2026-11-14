# @oppenheimer/api-client

## 0.4.0

### Minor Changes

- a602949: A task an agent made waits in Plan's Inbox until its person takes it up
  (`product/versions/mvp/29-inbox.md`, "Tasks an agent made").

  - `@oppenheimer/api`: `task` gains `origin` (`person` | `agent`) and
    `triagedAt` (migration `AddTaskOriginAndTriage`). A task made by a bot or on
    an API token or OAuth grant is the agent's and waits; the person (a browser
    session) takes it up by giving it a TODO day, starting or linking a session,
    or `POST /v1/tasks/:id/triage` (`tasks:write`). Task responses carry both
    fields. The bots' plan tools call the first column "Not started".
  - `@oppenheimer/shared`: `TASK_ORIGINS` and `TaskOrigin`; the bundled guide.
  - `@oppenheimer/api-client`: regenerated (`triageTask`, the two fields).
  - `@oppenheimer/frontend-consumer`: `TaskEntity` gains `origin`, `triagedAt`
    and `awaitsTriage`; the Inbox reads the board's tasks and lists a waiting
    one as a `task` item; `useTriageTask`.
  - `@oppenheimer/web`: the Inbox's task card (Put on today, Start session,
    Dismiss, Open task) and a Tasks type; Delete on a task also dismisses it
    (`takesUp` on the mark actions' table), while Mark as done stays a mark.
  - `@oppenheimer/translations`: `inbox.type.task`, `inbox.from.task` and
    `inbox.task.*`.

- 7b0e91d: A bot answers a yes before it does the work. Approving a Needs input card
  now queues, with the decision, a short turn where the bot says it is on it
  in its own voice ("On it, archiving those 25 now."), while the approved call
  runs; that turn's tools refuse to run and it has two round trips. The chat
  holds the call as a live line with its clock ("Running: …") under that
  sentence until the report lands, and the report's line reads "Done: …" (or
  "It failed: …") instead of a second "You approved". An approval event says
  which of the two lines it is (`stage`: `started` or `finished`); an "on it"
  turn whose call already ran ends without a word.
- 1d57cbf: A bot's Needs input card is a request with server-chosen decisions. The
  approval carries `availableDecisions` (`approve`, `approve_for_subject`,
  `approve_always`, `deny`, `stop`, in the order to draw them) and
  `POST /v1/bots/:id/approvals/:approvalId/decision` accepts only those
  (`BOTS_030` otherwise; the older `approve` with a `reach` still works).
  `deny` gives the bot a turn to carry on from; `stop` gives it none, writes
  the decision as a chat line outside any turn and asks the asking turn to
  stop. Every decision, and a card retired by a new message, is broadcast on
  the bot's stream as `approval_resolved`, so each open chat takes the card
  down at once and draws the decided line until the stored one lands; an
  approval event names its card (`approvalId`). The card draws its buttons in
  the API's order with keys (`y`, `p`, `a`, `n`, `c`), and a card raised while
  the bot's text is half a line waits for the line to end, at most 600 ms.
- d314623: Follow-ups to unbounded bot turns and goals:

  - A goal whose turn a provider refused for a limit with a known end (a rate
    limit's reset, a spent plan window's) waits until then and goes on by
    itself; it pauses for Resume only when no time is known.
  - The job that decides a goal turn's end is idempotent: run twice, it counts
    the turn once and queues one continuation.
  - Turns nobody waits on (a goal's, a loop's, a routine's, a wake's) run on a
    new `bot-background-turns` queue with its own worker, so a long one never
    holds a slot a person's message waits on.
  - A turn that compacted mid-turn shows one quiet trace line among its calls,
    with the tokens before and after (a new `compaction` message event).
  - The live line of a turn at work draws a thinking orb (`thinking-orbs`, MIT),
    its "composing" animation, in place of a spinner. `TraceLive` takes a
    `glyph`, the agent glyph when none is given, and a bot's clock reads "6s",
    "1m 5s" instead of "00:06".

- d5d4fd4: A goal held for a system's rate limit says so on its banner.

  - `@oppenheimer/api`: the goal records the wait its next decision is held
    for (`bot_goal."waitingFor"`, `"waitingUntil"`, migration
    `HoldBotGoalOnRateLimit`), set in the transaction that stages the held
    decision and cleared in the one that claims the next continuation;
    `BotGoalResponseDto.waiting` (`{ system, until }`, or null).
  - `@oppenheimer/api-client`: `BotGoalWaitingResponseDto`, and `waiting` on
    `BotGoalResponseDto`.
  - `@oppenheimer/shared`: `BotGoal.waiting`.
  - `@oppenheimer/web`: the goal banner draws a clock and "waiting for Gmail
    until 10:02" in place of the count while the goal waits.
  - `@oppenheimer/translations`: `bots.chat.goal.waiting`.

- c5c09d0: A bot can set itself a goal. `set_goal` and `end_goal` are new tools, and
  the goal is stored in a new `bot_goal` table, one per bot. When a turn ends
  with the goal open, a `goal` turn is queued to continue it (at most 5, or up
  to 10 if the bot asks). The continuation runs as the owner with the setting
  turn's reach, and is keyed so it is queued once. A continuation cannot set
  a new goal.

  The goal ends with a line in the chat when the owner stops it
  (`DELETE /v1/bots/:id/goal`, which also cancels a continuation still
  waiting), when its continuations run out, or when a turn of it fails or is
  stopped. `GET /v1/bots/:id/goal` reads it. The console shows it above the
  composer with Stop (`useBotGoal`, `useClearBotGoal`), and draws its lines
  as goal events.

- be15bdc: `/loop`, the third built-in command for bots: a prompt run now and again
  every interval, from a minute to a day, or when the bot says, until it is
  stopped, the bot ends it or it expires after 3 days
  (`product/versions/mvp/25-bots.md` §4.1).

  - `@oppenheimer/shared`: `loop` joins `BOT_BUILT_IN_COMMANDS`;
    `botLoopCommandOf` reads `/loop [interval] [prompt]` and `/loop stop`; the
    `BotLoop` and `BotLoopEvent` types, the `loop` turn origin and the
    `BOT_LOOP_*` bounds.
  - `@oppenheimer/api`: `bot_loop` (`AddBotLoops`), one per bot, set with the
    `/loop` message's turn; each run a background turn keyed by the loop and
    its number, queued by a delayed job that claims the loop's count and next
    run with it, skipped while the last run is busy; a run's end decides
    whether the loop ends; the bot's `schedule_loop` and `end_loop`;
    `GET` and `DELETE /bots/:id/loop`. `/loop stop` and an interval out of
    range are refused as messages.
  - `@oppenheimer/frontend-consumer`: `useBotLoop`, `useClearBotLoop`, loop
    events.
  - `@oppenheimer/web`: `/loop` in the `/` menu; the loop over the composer
    with how often it runs, when next and Stop; `/loop stop` runs there; a
    line for each run and for how the loop ended.
  - `@oppenheimer/translations`: `bots.chat.loop.*`, `bots.chat.event.loop.*`,
    `bots.chat.slash.builtIn.loop`.
  - `@oppenheimer/api-client`: `findBotLoop`, `clearBotLoop`.

- 38ffaaf: A bot's memory facts have a tier and a scope. A `profile` fact is in the
  prompt every turn (the newest 60); a `log` fact is looked up with `recall`.
  A `bot` fact is the bot's own; a `person` fact is about its owner, and every
  bot that person made in the workspace reads it, while it stays the row of the
  bot that learned it. `bot_memory_fact` gains `tier` and `scope`;
  `remember` takes `tier` and `about`, the memory routes take and return
  `tier` and `scope` (with `botId`), and `PATCH` changes any of the three.
  Settings → Memory tags each fact, moves it from its row's menu, and shows
  facts the owner's other bots shared, muted and read-only.
- e315b92: A bot tells the person a line in the Inbox (`product/next-steps/agent-tools.md` §5). Its new `notify` tool keeps the bot's latest line in `bot_notice` (one row per bot, a new id with each notice), raises `botNotice.changed` on the workspace stream, and `GET /v1/bot-notices` reads each bot's notice on the bots the caller may read, newest first, at most 50. The Inbox lists it as a `botNotice` item keyed `botnotice:<bot>:<notice>`, with Open chat and Done, counted under the Type facet's "Bots" (was "Bot approvals").
- b283349: A bot can follow a pull request. `watch_pull_request { repository, number,
purpose? }` subscribes it to an open pull request of a repository its owner
  can read through the workspace's GitHub installations, and
  `unwatch_pull_request` stops it; `list_watches` lists pull requests beside
  sessions. A failing or passing check, a submitted review, a comment or the
  merge on it wakes the bot with one queued turn per stored GitHub event, made
  only of the event's metadata (kind, number, repository, check name and
  conclusion, review state, actor login, each held to what GitHub allows) and
  never anyone's words; the bot reads them with `get_pull_request`. Our own
  app's events wake nobody. A merge ends the subscription after its wake; the
  wake limit (20) and the per-bot limit (50, sessions and pull requests
  together) are the session watches'.

  `bot_subscription` gains the `pull_request` kind: `resourceId` is nullable,
  and `githubRepoId`, `pullNumber` and `repositoryFullName` name the pull
  request, tied to the kind by `CHK_bot_subscription_subject`, with a unique
  index per bot and pull request and an index for the webhook's read. The chat
  draws the wake as one line, "Pull request #128 of acme/app: checks failed",
  from a new `pull_request` event kind. `PULL_REQUEST_WAKE_EVENTS` in
  `@oppenheimer/shared` is the one list a session's agent and a bot are woken
  by.

- cfa236a: A bot can ask its owner questions. `ask_user` puts up to four questions,
  each with two to four likely answers, on a card and ends the turn. The card
  is its own `bot_question` row, beside approvals rather than a kind of one:
  `GET /v1/bots/:id/question` reads the waiting card, and
  `POST /v1/bots/:id/questions/:questionId/answer` and `/dismiss` decide it
  (`BOTS_035` to `BOTS_037`). A bot has one card up at a time of either kind.
  The tool is offered only on turns a person is waiting on (`attendedOnly`).
  The bot's next turn, of origin `question`, is told each answer fenced as
  data, and the chat draws a `question` event with each answer under the
  line. The console answers with `ChatQuestionPicker`, the session question
  picker moved into the platform kit, whose keys moved to
  `common.chat.question`.
- be941d8: Skills for bots, run as slash commands (`product/versions/mvp/25-bots.md` §4.1).

  - `@oppenheimer/shared`: `botSkillSchema`, `updateBotSkillSchema`, the name
    rules and `parseBotSlashCommand` (`/<name> args` and `/skill <name> args`).
  - `@oppenheimer/api`: the `bot_skill` table and `/v1/bots/:id/skills`
    (list, create, update, delete; `BOTS_038` to `BOTS_040`); the bot's
    `use_skill`, `save_skill` and `delete_skill` tools; the prompt's "Your
    skills" list; and a message opening with `/<name>` runs that skill.
  - `@oppenheimer/api-client`: the skills operations.
  - `@oppenheimer/frontend-consumer`: `BotSkillEntity` and its hooks.
  - `@oppenheimer/web`: Settings → Skills, and the composer's `/` menu.
  - `@oppenheimer/translations`: their copy, English and Spanish.

- 929db14: A bot's call that a system's rate limit stopped is drawn as a wait, not a
  failure.

  - `@oppenheimer/api`: a tool step keeps the limit its call ended on
    (`rateLimit: { system, resetAt }` on the stored step and on
    `BotToolStepResponseDto`); null when none stopped it.
  - `@oppenheimer/api-client`: `BotToolStepRateLimitResponseDto`, and
    `rateLimit` on `BotToolStepResponseDto`.
  - `@oppenheimer/frontend-consumer`: `BotToolStep.rateLimit`, with `resetAt`
    as a `Date`.
  - `@oppenheimer/web`: the chat's trace draws a limited step with a clock and
    "Gmail limit · until 10:02" in the line's colour instead of the red
    "failed", and a group of calls does not count it as failed; an exported
    chat marks it the same way.
  - `@oppenheimer/translations`: `bots.chat.activity.stepLimited`.

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

- 39dbe36: Bots, the Needs input card (`product/versions/mvp/25-bots.md` §5).

  - `@oppenheimer/shared`: `BOT_APPROVAL_STATUSES`, `decideBotApprovalSchema`,
    `findBotApprovalsSchema`, the `event` message role and the `approval`
    stream event.
  - `@oppenheimer/api`: `bot_approval`; under Approve for me an asking tool's
    call becomes a pending approval (one per bot) instead of running;
    `GET /v1/bots/:id/approvals` and
    `POST /v1/bots/:id/approvals/:approvalId/decision`, which runs the stored
    call as the owner on a yes and queues a turn opened by an `event` message
    either way; a new message expires the card. Errors `BOTS_015`, `BOTS_016`.
  - `@oppenheimer/api-client`: the approval operations.
  - `@oppenheimer/frontend-consumer`: approvals on the bots repository and their
    hooks.
  - `@oppenheimer/web`: the Needs input card above the composer, and the event
    line in the transcript.
  - `@oppenheimer/translations`: the card's copy and `errors.byCode.BOTS_015`–`BOTS_016`.

- 201ee3a: A bot's chat queues what you write while it works and shows the room it has
  left. Each waiting message sits over the composer with Remove, Edit and Send
  now. The engines report the context of a turn's last answer (with the
  model's window on the Claude engine) and, on a ChatGPT sign-in, the plan's
  5-hour and weekly windows from the Codex usage headers; each turn keeps them
  (`contextTokens`, `contextWindow`, `planLimits`) and the composer's meter,
  now the platform kit's `ChatUsage` shared with the session chat, reads the
  newest.
- 502a40c: Bots, slice 2 (`product/versions/mvp/25-bots.md` §2): a bot answers.

  - `@oppenheimer/shared`: the provider catalog (`BOT_PROVIDERS`,
    `BOT_PROVIDER_CATALOG`), the provider key schema, the turn and message
    vocabulary (`BOT_TURN_STATUSES`, `BOT_MESSAGE_ROLES`, `sendBotMessageSchema`,
    `BotStreamEvent`) and the `bot-turns` queue.
  - `@oppenheimer/api`: a workspace's model provider keys, sealed under
    `BOTS_PROVIDER_KEY` (`/v1/model-providers`); a bot's provider; turns and
    messages (`bot_turn`, `bot_message`), `POST /v1/bots/:id/messages`, Stop,
    `GET /v1/bots/:id/conversation` and the `GET /v1/bots/:id/stream` SSE; the
    `bot-turns` worker running each turn on `@oppenheimer/backend-agents`, one
    per bot at a time. Errors `BOTS_011`–`BOTS_014`.
  - `@oppenheimer/api-client`: the provider and chat operations.
  - `@oppenheimer/translations`: `errors.byCode.BOTS_011`–`BOTS_014`.

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

- 8deebf8: Bots, `create_bot` (`product/versions/mvp/25-bots.md` §4.6).

  - `@oppenheimer/api`: the `create_bot` tool, which asks under Approve for me.
    It dispatches the console's create command as the owner, with the name,
    description, soul, instructions, provider, model, effort, permission and
    group; the provider and model default to the creator's, a provider with no
    workspace key is refused, and the permission is never looser than the
    creator's. `bot."createdByBotId"` marks the creator, and `bot."idempotencyKey"`
    makes a retried or racing creation make one bot.
  - `@oppenheimer/api-client`: `createdByBotId` on the bot.

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

- 060dabb: Bots in the console's sections (`product/versions/mvp/28-bots-in-sections.md`).

  - `@oppenheimer/shared`: `BOT_SECTIONS` (`sessions`, `automations`, `plan`,
    `pulls`), and `sections` on the create and update bot inputs.
  - `@oppenheimer/api`: `bot."sections"`, the set of sections whose sidebar lists
    the bot, empty by default; `POST /v1/bots` and `PATCH /v1/bots/:id` take it,
    and `update_profile` lets a bot place itself.
  - `@oppenheimer/api-client`: `sections` on the bot.
  - `@oppenheimer/frontend-consumer`: `BotEntity.sections`,
    `useSuspenseSectionBots`, and `useCreateBot` taking the sections.
  - `@oppenheimer/web`: a Bots heading in Sessions, Automations, Plan and Pull
    requests, whose plus makes a bot there; a bot's chat inside Pull requests at
    `/pulls/bots/$botId`; Shows in on a bot's Profile.

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

- 3dbe5f1: A bot's Settings → Permissions: each tool Allow, Ask or Off over the preset, the standing grants a yes left, and plain-language rules. A Needs input card can say yes past its call, for the repository, project or session it acts on or for the tool (merging stays per call), says when the call sends something out of Oppenheimer, and shows the call as it will run. Before an asking call a rule could change, a reviewer on the bot's own model reads the rules: an ask rule wins, an allow rule lets the call run and its line says which, and a review that cannot say asks.
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

- 581c202: Bot settings polish (`product/versions/mvp/25-bots.md`, 2026-10-16).

  - `@oppenheimer/api`: `GET /bots/:id/conversation/export` streams the whole
    chat as NDJSON, one message per line, a page at a time; `DELETE /bots/:id/conversation` clears it (turns,
    messages, cards, summary, sidebar line) in one transaction, refused with
    `BOTS_022` while a turn is queued or running; the conversation read
    carries `messageCount`.
  - `@oppenheimer/api-client`: `exportBotConversation`, `clearBotConversation`,
    `messageCount`.
  - `@oppenheimer/frontend-consumer`: `useSuspenseBotHistory`,
    `useExportBotConversation` (reads the NDJSON stream a line at a time),
    `useClearBotConversation`.
  - `@oppenheimer/backend-core`: `ndjsonLines` and `NDJSON_CONTENT_TYPE`.
  - `@oppenheimer/frontend-web`: `SettingsFormSaveRow`, the dirty / pending /
    saved foot of a settings form.
  - `@oppenheimer/design-system-web`: `SettingsListRow`'s `kind` tag never wraps;
    the meta beside it does.
  - `@oppenheimer/translations`: Home host, chat history, `BOTS_022`, and the
    shorter ChatGPT sign-in chip.

- 6af341b: Bots, slice 1 (`product/versions/mvp/25-bots.md`): a bot without a runtime.

  - `@oppenheimer/shared`: `bot.schema.ts` (create and edit a bot and a group,
    save a document over a base revision, a memory fact, the revisions query)
    with `BOT_AVATAR_COLORS`, `BOT_DOCUMENT_NAMES`, the bounds and the default
    soul; the `Bot` subject, the owner's rule on it, the `bots:read` /
    `bots:write` scopes and the bot endpoints in `ENDPOINT_POLICIES`.
  - `@oppenheimer/api`: the `bots` module and its migration: `bot`,
    `bot_group`, `bot_document`, `bot_document_revision` and
    `bot_memory_fact`, with `/v1/bots`, `/v1/bot-groups`, a bot's documents and
    revisions (save over a base revision, revert as a new revision) and its
    memory. Errors `BOTS_001`–`BOTS_010`.
  - `@oppenheimer/api-client`: the bot operations.
  - `@oppenheimer/translations`: `errors.byCode.BOTS_*`.

- 0044013: A Google event that is a video meeting can be joined from Plan's calendar: its dialog offers Join meeting, opening the event's Meet link, the video link a Zoom or Teams add-on attached, a location that is itself an `https:` address, or a Zoom, Meet, Teams or Webex join link pasted in the location or the description. Calendar events carry it as `meetingUrl`, null when there is none.
- c11f8a3: What a failing check came to is a record. `record_ci_findings` lets a bot file
  one finding per failing check on a pull request's head
  (`pull_request_ci_finding`): the cause, its relation to the change, a flake
  verdict, the action and how sure, with up to five pieces of evidence. A second
  look at a check on the same commit replaces the first. It is filed only for a
  check failing on the head GitHub shows (`PULLS_003`, `PULLS_004`). A pull
  request's checks now name each failing one with its result, log and summary;
  `get_pull_request` and the detail response (`checkCounts.failing`,
  `ciFindings`) carry them, and the console's Checks rail lists them with their
  findings.
- 8baff58: Sessions in Claude Code's cloud. New session's Where offers _Claude Code
  cloud_ on a host: that host's runner fetches the repository with a token
  sealed into the create, runs `claude --cloud <task>` in a scratch checkout,
  reports the cloud session's id and keeps nothing. The session's pane has no
  terminal: its state, _Open in claude.ai_ and `claude --teleport <id>`. Its
  state comes from the Chrome extension, which, connected with a personal token
  pinned to the workspace, posts what it sees on claude.ai to
  `POST /sessions/cloud-status`; the API records it for the sessions the
  workspace launched (`place: cloud`, `cloudSessionId`, runner capability
  `session.cloud`, errors `SESSIONS_037` and `SESS_008`).
- 33cb1d8: Cloud sessions: a session can run in Cursor's cloud on the person's own
  Cursor key, chosen in New session's place picker
  (`product/next-steps/cloud-agents.md`).

  - `@oppenheimer/shared`: the `cloud` session place, `HOST_SESSION_PLACES`,
    `SESSION_AGENT_IDS`, `startCloudSessionSchema`, `CLOUD_AGENT_IDS` and the
    credential schemas, the `CloudAgent` subject and the `cloud-agents` scopes.
  - `@oppenheimer/api`: `POST /v1/sessions/cloud`; a cloud session is a
    `work_session` with no host and a `session_cloud_run`, its vendor status
    folded into its log and synced on read within Cursor's budget; host-only
    commands refuse it with `SESSIONS_036`. The `cloud-agents` module keeps the
    sealed key (`cloud_agent_credential`, `CLOUD_AGENTS_KEY`), the status, the
    models and repositories, and publishes `CLOUD_RUNS` to sessions.
  - `@oppenheimer/api-client`: `startCloudSession` and a session's `cloud`.
  - `@oppenheimer/frontend-consumer`: a session's `cloud`, `useStartCloudSession`,
    a `cloudSession` poll, the slimmed `cloudAgents` module.
  - `@oppenheimer/web`: Cloud in the place picker, Cursor in the agent picker,
    cloud rows in the sidebar that open Cursor, a cloud session's page, and
    Settings → Cloud agents.

- 55acf65: A reply typed in a Claude Code cloud session's chat wakes the session when
  it is idle (`product/next-steps/cloud-agents.md`, "Waking an idle session").

  - `@oppenheimer/shared`: the link's `cloud.reply` and `cloud.replied`, the
    `session.cloud.reply` capability, the `cloud-reply-wakes` queue,
    `CLOUD_REPLY_WAKE_AFTER_SECONDS` and `CLOUD_REPLY_DELIVERIES`.
  - `@oppenheimer/runner`: names `session.cloud.reply` and answers
    `cloud.reply` with `claude -p <text> --cloud <id> --output-format json`
    on the host's own claude.ai sign-in: `SESS_020` when Claude Code refuses,
    `SESS_021` when it gives no answer in 45 seconds, `SESS_019` signed out.
  - `@oppenheimer/api`: every reply is kept with a wake staged for 15 seconds
    later; if the Stop hook has not taken it, an online host signed in to the
    account of the host that started the session sends it. The hook's take
    and the wake claim the same row, so a reply goes once
    (`session_cloud_reply."deliveredVia"`); one the host certainly did not
    send goes back to the hook.
  - `@oppenheimer/api-client`: a cloud chat reply's `deliveredVia`.
  - `@oppenheimer/frontend-consumer`: the cloud chat feed's `onWaiting`
    becomes `onPending`, with each reply marked `waiting` or `sent`; a reply a
    host sent reads as sent until the transcript has it.
  - `@oppenheimer/web`: the cloud chat's bar says a reply was sent rather than
    waiting.
  - `@oppenheimer/translations`: `sessions.cloudChat.sent`.

- 3230edb: Cloud sessions in tasks and automations. A task's Start session and an
  automation's runs pick where the session runs, as New session does: on a
  host, in Claude Code's cloud started from a host, or in Cursor's cloud on the
  person's key with no host (`AUTOMATION_PLACES`, each place's host and agent
  in `AUTOMATION_PLACE_RULES`). `POST /tasks/{id}/sessions/cloud` launches a
  task at a vendor beside `POST /tasks/{id}/sessions`; an
  automation's revision carries `place`, with `hostId` null at a vendor
  (migration `AddAutomationPlaces`). A run in the cloud holds no place on a
  host, and one whose owner has no key for the vendor pauses the automation as
  `cloud_key_missing`.
- 61f1092: Sessions in Codex's cloud, the way Claude Code's cloud works. New session's
  Cloud tab has a _Codex_ row beside _Claude Code_: a host that can starts the
  task with its own `codex cloud exec` on the repository's base branch, in the
  Codex environment named for the repository, and keeps nothing. Unlike
  Claude Code's cloud, the host also follows it: the runner reads
  `codex cloud list --json` once a minute while a task it started is
  unsettled and reports it as the session's state (working, done, failed). The
  pane offers _Open in ChatGPT_ and `codex apply <id>`. Runner capability
  `session.cloud.codex`; hosts say `startsCodexCloudSessions`; the runner's
  `SESS_009` carries the CLI's own words when it refuses; `SESSIONS_038` now
  names either vendor.
- 6eb8d65: Continue a Claude Code cloud session on a host. The cloud session's pane
  offers _Continue on a host_: pick a host and the console starts a worktree
  session there on the cloud session's repository whose agent runs
  `claude --teleport <id>`, then opens it. `POST /sessions` takes `teleport`
  (a cloud session id, with one checkout and no prompt); the launch keeps it
  (`launchTeleport`), so a re-sent create continues the same cloud session and
  a restart reopens it with `claude --continue`. The runner names the new
  capability `session.teleport`; a host whose runner does not is refused with
  `SESSIONS_048`. Claude Code names the teleported conversation itself, so the
  runner finds it as the newest transcript in the session's folder and keeps
  its name, which the chat view reads it by.
- d68e9c4: New session's folder picker searches the host by name
  (`product/versions/mvp/24-session-places.md` §4).

  - `@oppenheimer/shared`: the link gains `fs.find` and `fs.found` and the
    `fs.find` capability; `hostFolderSearchQuerySchema` is the endpoint's query.
  - `@oppenheimer/runner`: answers `fs.find` with a walk under home bounded by
    depth (4), directories read (20,000) and time (400 ms), that skips hidden
    directories and dependency trees and does not walk into git repositories.
  - `@oppenheimer/api`: `GET /v1/hosts/{id}/folders/search?q=`, refused as a
    listing of home is.
  - `@oppenheimer/api-client`: `searchHostFolders`.
  - `@oppenheimer/frontend-consumer`: `HostsRepository.searchFolders`,
    `useHostFolderSearch`, `HostFolderSearch`.
  - `@oppenheimer/web`: typing narrows the listed folder to names that hold
    what is typed, those that start with it first; `~billing` is read as
    `~/billing`; a bare name is searched for under home after typing pauses,
    and what is found shows under the listing; a search the host could not
    make says why there, except on a runner too old to search.
  - `@oppenheimer/translations`: `sessions.new.folder` gains `searchHeading`,
    `searching`, `searchTruncated` and `searchFailed`; `emptyFiltered` says
    "in its name".

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

- aeeb48b: The product's mark is a white fedora on an ink tile, the same in both
  themes: `BrandMark` draws it (new `--brand-tile` and `--brand-hat` tokens).
  It is the rail's top, `RailMark`, a link home in the console, and stands
  beside the name on sign-in and the public pages; the console's and the
  docs' favicons and the extension's icons are the same drawing.

  A bot with no photo shows a drawn face instead of its initials: a round
  face in its avatar colour wearing a hat, cut out like a sticker on a darker
  shade of that colour. The hat, eyes and mouth are picked from the bot's id,
  so the face survives a rename. `BotAvatar` and `BotItem` take `face`
  (`{ color, seed }`, the bot's colour and id) in place of `color`, and
  `AvatarColorPicker` takes `seed`; without a `face` they draw the initials
  on the control fill.

  A bot's owner picks its face in Profile, under the colour: `BotFacePicker`
  offers a row each for the hat, the eyes and the mouth, drawn in the bot's
  colour, and Use its own face goes back to the id's. It is stored as
  `bot."avatarFace"` (`jsonb`, null until picked, held by
  `CHK_bot_avatar_face`), sent as `avatarFace` on `PATCH /v1/bots/:id` and
  answered on every bot; `BotFaceSpec` takes it as `parts`, and the
  consumer's `BotEntity.face` hands the three together.

  `Wordmark` is the name alone again; the console's rail carries the mark at
  its top (`RailMark`, now `BrandMark`, a link home with the `nav.home` name).

- 291469b: Hidden sessions: a session can be kept out of the console's sidebar and
  shown again, and it runs the same either way
  (`product/next-steps/hidden-sessions.md`).

  - `@oppenheimer/api`: a `session.visibility_set` log entry folded into
    `work_session.hidden` (migration `AddSessionHidden`).
    `PUT /sessions/{id}/visibility` hides or shows a session. `POST /sessions`
    and `POST /sessions/cloud` take `hidden`, and the session response carries
    it. The bots' `start_session` and `start_cloud_session` take `hidden`.
  - `@oppenheimer/shared`: `createSessionSchema` and `startCloudSessionSchema`
    gain `hidden`; `setSessionVisibilitySchema`; `sessionLaunchBody` takes
    `hidden`.
  - `@oppenheimer/frontend-consumer`: `SessionEntity.hidden`,
    `sessions.setHidden` and `useSetSessionHidden`.
  - `@oppenheimer/frontend-web`: `useStoredBoolean`, a boolean kept on this device; Pinned only and Show hidden sessions read through it.
  - `@oppenheimer/web`: Hide / Show in a session row's menu. The filter menu
    gains Show hidden sessions, with a count. While it is on, hidden sessions
    are listed marked Hidden.
  - `@oppenheimer/cli`: `opp sessions run --hidden`, `opp sessions hide <id>`,
    `opp sessions show <id>`.
  - `@oppenheimer/mcp`: `start_session` takes `hidden`; `set_session_visibility`.
  - `@oppenheimer/translations`: `sessions.sidebar.hide`, `show`, `hidden`;
    `sessions.filters.showHidden`; the toasts `sessionHidden` and `sessionShown`.

- 48da240: The Inbox's API (`product/versions/mvp/29-inbox.md` §4). `GET /v1/bot-approvals?status=pending` reads the workspace's approvals across its bots, newest first, at most 100, each with `botId`, `botName` and `sessionId`, under `bots:read` and `IDX_bot_approval_org_status`. Every move of an approval (raised, decided, expired, run) now raises `BotApprovalChangedDomainEvent`, which the workspace stream sends as `botApproval.changed`.

  A new `inbox` module keeps a person's marks on Inbox items in `inbox_mark` (`done`, `low`, `snoozed` until a time, `deleted`; one per person, workspace and occurrence): `GET /v1/inbox/marks` (a snooze that has ended is left out), `PUT /v1/inbox/marks/:itemKey` and an idempotent `DELETE /v1/inbox/marks/:itemKey`, under the new `inbox:read` / `inbox:write` scopes, which, like `profile`, no role backs, and the `inbox` release flag. Each write sends `inboxMark.changed` to that person's streams only. Errors `INBOX_001`–`INBOX_004`.

  `@oppenheimer/shared` adds `INBOX_MARKS`, `putInboxMarkSchema`, `inboxItemKeySchema`, `findWorkspaceBotApprovalsSchema` and the two events; the console refetches `['bots', 'approvals', 'pending']` and `['inbox', 'marks']` on them.

- 1484bc6: The Inbox takes bulk actions. Check rows (on hover, shift-click for a run, or Select in a row's menu), then mark them all done, deprioritize, snooze or delete them from the bar that replaces the list's head. Escape clears the selection. The API marks a whole selection in one request, `POST /v1/inbox/marks/batch`, checking every key before it writes any.
- 7c0a70c: Inbox reports, the API (`product/versions/mvp/29-inbox.md`, "Reports"). The `inbox` module stores its one item, a report, in `inbox_report`: `POST /v1/inbox/reports` takes a title, a body, a source and a link as `multipart/form-data` with up to 4 PNG, JPEG, GIF or WebP pictures of up to 5 MB each under `images`, judged by their bytes and kept in storage; `GET /v1/inbox/reports?status=open|answered` lists the workspace's, newest first, at most 100; `GET /v1/inbox/reports/:id` is what the sender polls for the answer; `GET /v1/inbox/reports/:id/images/:imageId/content` reads a picture. These are under the new `inbox-reports:read` / `inbox-reports:write` scopes, which, like `inbox`, no role backs. `POST /v1/inbox/reports/:id/answer` is under `inbox:write`, so a token holding only the report scopes cannot answer what it asked; a report is answered once. Each send and answer reaches the workspace's streams as `inboxReport.changed`. Errors `INBOX_005`–`INBOX_009`.
- c63402e: Answer a session's question or permission from anywhere but its terminal
  (the server half of the Inbox's slice 4, `29-inbox.md`).

  - `@oppenheimer/shared`: `SessionDecision` (a `question` from
    `AskUserQuestion`, or a `permission` dialog), the `agent.decision` payload,
    `answerSessionDecisionSchema`, and `@oppenheimer/shared/sessions` with
    `questionKeys`, `permissionKeys` and `QUESTION_KEY_GAP_MS`, moved from the
    console so the API types the same keys. The Go twin of the decision is
    generated (`emit-session-decision.cjs`).
  - `@oppenheimer/runner`: reports `agent.decision` when what a blocked agent
    waits on appears, changes or clears: the transcript's open
    `AskUserQuestion`, else Claude Code's permission dialog read off the
    screen.
  - `@oppenheimer/api`: folds it as `pendingDecision` (a new `jsonb` column),
    answers it on sessions as `decision`, and adds
    `POST /v1/sessions/:id/decision`, which types the answer into window 0 as
    `session.input` and records `decision.answered`. New codes `SESSIONS_032`
    (already answered or changed), `SESSIONS_033` (does not fit) and
    `SESSIONS_034` (host offline).
  - `@oppenheimer/api-client`: `answerSessionDecision`, and `decision` on
    `SessionResponseDto`.
  - `@oppenheimer/frontend-consumer`: the chat view imports `questionKeys`
    from `@oppenheimer/shared/sessions`.
  - `@oppenheimer/translations`: messages for `SESSIONS_032`–`SESSIONS_034`.

- ac40af9: What the Inbox keys an occurrence by (`product/versions/mvp/29-inbox.md` §3): a session now reports `observedSince` (when its agent entered the state it was last seen in) and `stateSeq` (bumped on every change of `lifecycle`), and every pull request row carries its `headSha`, which only the briefing did before.
- a3a780b: `opp` and the MCP server: people, scripts and agents on other hosts drive
  Oppenheimer over the API (`product/next-steps/0.6-mcp-cli-and-agent.md`).

  - `@oppenheimer/cli`: new. `opp hosts`, `projects`, `sessions
list|get|run|send|wait|stop|close`, `automations
list|create|run|pause|resume|delete`, `bots list|chat`, `tasks
list|add|move`, `tokens` and `mcp install|status`, on a scoped API token
    that `opp login` pins to the caller's workspace. Built from the Flama
    boilerplate's `cli` plugin.
  - `@oppenheimer/mcp`: new. The same verbs as MCP tools over stdio and
    Streamable HTTP, offered only when the credential's scopes cover them.
    Built from the Flama boilerplate's `mcp` plugin; a blank variable in the
    environment now reads as unset.
  - `@oppenheimer/http-client`: new. The transport both clients call the API
    through (`HttpClient`, `HttpTransportError`) and `readProblem`, which reads
    a failed answer's problem document once for both.
  - `@oppenheimer/api`: `POST /v1/sessions/{id}/prompt` types a follow-up
    prompt into a session's agent for a person's credential (`sessions:write`),
    the command the bots already use, logged as `{ kind: 'person', userId }`,
    and answers `{ seq, session }`: where the prompt landed in the log.
  - `@oppenheimer/shared`: `sendSessionPromptSchema`, and in
    `@oppenheimer/shared/sessions` what both clients launch and wait with:
    `sessionLaunchBody`, `pickProjectCheckout`, `isSessionSettled`,
    `agentTookWorkAfter` and `isWorkSettled`.
  - `@oppenheimer/api-client`: `sendSessionPrompt` and
    `SentSessionPromptResponseDto`.

- da6226c: Settings → Memory, at the account: what all your bots know about you, in one
  place, the way Claude's memory works. _About you_ is a text you write
  (`person_memory`, up to 4,000 characters), in the system prompt of every bot
  you made in the workspace and never changed by a bot. Under it is every fact
  about you that a bot of yours learned, naming the bot that keeps it; edit,
  move and forget act on that bot. `GET /v1/bot-memory/person` reads both and
  `PUT /v1/bot-memory/person/about` writes the text.
- 9871b11: Plan's board drops the Later column and gains In review, between In
  progress and Done: `TASK_STATUSES` is `todo`, `doing`, `review`, `done`.
  A migration moves every task in Later to the end of To do, in its order,
  and bumps its version. Attaching a session still moves a task in To do to
  In progress. The CLI's and MCP server's status choices, the bots' plan
  tools and `tasks.columns` follow.
- 250c8d6: Plan's To do is what you mean to work on, not only what is due: a task has a To do day (`focusDate`) apart from its due date, set in the task dialog, by the dashed row or with Add tasks. To do lists what is put on the day and what is due on it, keeps unfinished work from earlier days until it is done, and keeps a task ticked done on the day it was done.
- 04188eb: An archived project can be restored. `POST /v1/projects/{id}/restore`
  (`restoreProject` in the client) brings the same row back with its slug, so
  nothing is reissued, and announces `project.changed`; restoring an active
  project changes nothing. The automations its archive paused stay paused.
  A bot does it with `restore_project`, which runs like the other project
  writes, and `archive_project` no longer says an archive is final.
- 146d7d1: The review deck: the PR queue one pull request at a time.

  - `@oppenheimer/api`: `GET /v1/pulls/:installationId/:githubRepoId/:number/brief`
    answers a pull request's brief for its head commit (one sentence, up to four
    points, where to look first, the description's pictures), written by the
    deployment's model (`LLM_*`) and kept per commit, or taken from the
    description when there is no model.
  - `@oppenheimer/web`: `/pulls/review`, a third view in the Pull requests
    sidebar. A full-width card per pull request with its brief and one
    link to review it in depth; Pass, Comment or Request changes, Approve,
    Approve and merge and Merge each move to the next card, by button or key. Review next in the queue opens it, and a pull
    request opened from a card goes Back to that card.
  - `@oppenheimer/frontend-consumer`: `useSuspensePullRequestBrief`,
    `usePrefetchPullRequestBrief` and the `PullRequestBrief` type.
  - `@oppenheimer/api-client`: regenerated.
  - `@oppenheimer/translations`: `pullRequests.deck` (its buttons reuse `pullRequests.review`), `pullRequests.sidebar.review`
    and `pullRequests.detail.backToDeck`.

- d4606c6: Pull requests on the 2026-10-13 screens, without the chat and the review
  agent.

  - `@oppenheimer/shared`, `@oppenheimer/api`, `@oppenheimer/api-client`: a
    review's verdict is `comment`, `approve`, `approve_and_merge` or
    `request_changes`. `approve` only approves now; `approve_and_merge`
    merges at once when GitHub allows it and otherwise turns on GitHub's
    auto-merge, answering `{ merged, autoMerge }`. The queue is ordered by
    lane (Deep first) and then the longest wait, and the path to merge is
    three gates (checks, conflicts, merge).
  - `@oppenheimer/frontend-consumer`: `ReviewOutcome`; the activity read
    (`usePullRequestActivity`) is removed.
  - `@oppenheimer/web`: a pull request is Description and Changes (a link to
    `?view=briefing` opens the description); the queue filters by repository,
    Difficulty, Checks and Waiting, with `j`/`k`, Enter and `/`; Review opens
    the changes; Settings → Watched repositories is where watching is set.
  - `@oppenheimer/design-system-web`: `MergePath` is the one-row status strip;
    `PullRequestTable` folds in three widths (1080px, 720px); `ChipSelect`
    options take a `count`. `FactTile`, `FactGrid`, `DiffCommentLink` and the
    Stepper's horizontal orientation are removed.
  - `@oppenheimer/translations`: the new queue, review, Settings and toast
    copy; the briefing, rail, activity and lane-reason keys are removed.

- 1dbae54: A failed session start can be tried again. The start pane's **Try again**
  sends the host the same start, for the same session and with the same task
  (`POST /v1/sessions/{id}/retry`, `SESSIONS_052` for a session whose start did
  not fail), and draws the new attempt in place. A host whose Claude Code is not
  signed in to claude.ai refuses a cloud start with `SESS_019`, which the pane
  explains; the CLI's own words reach the console without its terminal escapes
  and with their spaces.
- 6917f62: Review sessions: a pull request's Chat tab starts Claude Code on one of your hosts, in a worktree of its head branch, on a review prompt that opens with a two-or-three-line take, then shows its terminal with an input line under it. Review sessions are listed under For review in the Pull requests sidebar and left out of Sessions (`origin = 'review'`, `pull_request_review_session`). New routes: `POST /pulls/…/review-session` and `GET /pulls/review-sessions`; a fork's pull request is `PULLS_002`. The pull request detail says whether its head is in a fork (`fromFork`).
- d69ddc4: A session carries the agent's own word on what it is doing, when it gave
  one through OSC 7501 (the runner's `pty` wrapper keeps it).

  - `@oppenheimer/shared`: `sessionAgentReportSchema` (`state`, `kind`,
    `progress`, `message`, `title`) and its state and kind lists.
  - `@oppenheimer/api`: the fold keeps the `program` of the last
    `agent.observed` as `work_session.agentReport` (migration
    `FoldSessionAgentReport`), clears it on an observation read off the
    screen and when the session stops, fails, closes or starts again, and
    answers it as `agentReport` on every session.
  - `@oppenheimer/api-client`: `SessionAgentReportResponseDto`.
  - `@oppenheimer/frontend-consumer`: `SessionEntity.agentReport`.
  - `@oppenheimer/web`: the session bar follows the state word with why the
    agent waits ("Needs your permission") and its own message.
  - `@oppenheimer/translations`: `sessions.session.agentReport`.

- 45d642b: A session runs in a new worktree or in a folder already on the host
  (`product/versions/mvp/24-session-places.md`).

  - `@oppenheimer/runner`: the work folder is `~/oppenheimer/<account>/<workspace>/{repos,
agents, sessions}`, with bare stores and a `.oppenheimer/` marker in every
    folder the runner makes; a folder session runs in the person's folder and
    writes nothing there; `fs.list` lists a host's directories. The old
    `~/oppenheimer-ai/workspaces` layout is not migrated.
  - `@oppenheimer/shared`: `session.create` carries the account and workspace
    ids and either checkouts or a `folder`; `fs.list` / `fs.listing`; the
    `session.folder` and `fs.list` capabilities; `createSessionSchema` takes a
    `folder` instead of checkouts.
  - `@oppenheimer/api`: `work_session` records the place and the folder;
    `GET /v1/hosts/{id}/folders` lists a folder through the runner with the
    caller's recent folders; `SESSIONS_025`–`031`.
  - `@oppenheimer/web`: New session's Where chip (New worktree, Folder on
    host), the folder picker, Open terminal on a host in Settings, folder and
    terminal icons in the sidebar. The permission level opens on `auto` and is
    remembered.
  - `@oppenheimer/design-system-web`: `Composer` takes `allowEmpty`, so a
    blank terminal can start with no first task.

- fe61b51: Sharing a session follows the `ShareSession` design
  (`product/versions/mvp/21-session-share-links.md`): one share per session
  at one address, `/s/<slug>`, for named people or anyone signed in; view, or
  write for named people for 24 hours at most. The Share dialog opens from a
  row's menu and the terminal's status line, and the guest page is one bar
  and the terminal. The share-link routes are replaced by
  `GET`/`PUT`/`DELETE /v1/sessions/{id}/share` and
  `PATCH /v1/sessions/{id}/share/people`; existing links are dropped. The
  design system gains `RadioGroupCard` (with `columns` on `RadioGroup`) and an
  `actions` slot on `SessionPaneHeader`.
- 1f7f57b: Sessions: read a session's conversation, and message coding agents both ways.

  - `GET /v1/sessions/{id}/transcript` (`sessions:read`) reads what a session's
    agent said and did, a page at a time off its host over the new
    `transcript.read` / `transcript.page` link messages, with an opaque cursor,
    secrets redacted, and a `status` (`complete`, `partial`, `unsupported`,
    `unavailable`) and `reason` on every page. A cloud session's conversation
    is `unsupported` with its vendor's link. Bots get `read_session_transcript`,
    MCP a tool of the same name, and `opp` `sessions transcript`.
  - A Cursor cloud session takes a follow-up prompt (`send_to_session`,
    `POST /v1/sessions/{id}/prompt`) as a new run of its agent, on its
    launcher's key, only once its last run ended (`CLOUD_AGENTS_012` while
    Cursor says it is busy, `SESSIONS_050` for anyone but the launcher).
  - An agent's `runner sessions notify` wakes every bot that follows its
    session, once per notice, the words fenced as the agent's.

- b5a9490: Settings → About shows the version of the console and of the API it talks to. The API answers its version at `GET /health/version`.
- f8eda6e: Bots answer their owner on Telegram. A Telegram bot is bound to one of the
  owner's Oppenheimer bots (`PATCH /v1/telegram/accounts/:id`), and a one-time
  `t.me/<bot>?start=<code>` link (`POST /v1/telegram/accounts/:id/owner-link`)
  records the owner's Telegram account. Their messages in their direct chat
  start a turn of that bot in a conversation of its own (`bot_conversation`;
  `bot_turn` and `bot_message` gain `conversationId`, the console chat's being
  the bot's id), and the turn's answer is sent back as a reply. `/new` starts a
  fresh conversation, `/stop` stops the running turn, `/help` says how. Anyone
  else gets one fixed line a day and reaches no bot; groups are ignored. A bot
  that answers on a Telegram bot cannot be deleted (`BOTS_042`). Settings →
  Telegram gains an "Answers you" row: the bot that answers, and Link your
  Telegram.
- db4ae58: Bots can read and answer the chats of a Telegram bot the owner made with
  @BotFather, the way OpenClaw does it. The runner holds the bot's token on
  the host and long-polls the Bot API (no webhook, no public URL), pacing its
  sends to Telegram's limits and pausing on a `429`. `RUNNER_TELEGRAM=off`
  turns it off. The link gains the `telegram` capability and its `telegram.*`
  frames.

  The new `telegram` module keeps each bot (`telegram_account`, one per host)
  and the messages it receives (`telegram_message`, 90 days), behind
  `GET`/`POST /v1/telegram/accounts` and `DELETE /v1/telegram/accounts/:id`
  with the `telegram:read`/`telegram:write` scopes; the token crosses the
  control plane once and is never stored there. Bots get
  `list_telegram_accounts`, `list_telegram_chats`, `read_telegram_chat`,
  `search_telegram` and `send_telegram_message`, which asks unless the owner
  allowed it for that chat. Settings → Telegram connects and disconnects.

- 2d187ed: Update a host's runner from the console: **Update runner** in a host card's
  menu on Settings → Hosts (09 §5, "Manual control").

  - `@oppenheimer/api`: `POST /v1/hosts/{id}/update` sends `host.update` down
    the host's link, through the links module's registry, and answers `202`.
    A host with no live link is `HOSTS_008` (409).
  - `@oppenheimer/shared`: `host.update`'s `version` is optional. Absent, the
    runner installs the newest release on its channel and stays unpinned (a
    pinned host refuses); present, it pins, as before.
  - `@oppenheimer/runner`: the generated `HostUpdate` omits an empty `version`,
    and a versionless `host.update` respects a pin (`ApplyOptions.KeepPin`):
    it skips the safe window, but a pinned host refuses with `UPD_004`.
  - `@oppenheimer/api-client`: `updateHostRunner`.
  - `@oppenheimer/frontend-consumer`: `HostsRepository.updateRunner` and
    `useUpdateHostRunner`.
  - `@oppenheimer/web`: the menu item, off while the host is offline, opens a
    confirm (`UpdateRunnerDialog`) that says what the restart does; a
    `hostUpdateRequested` toast on success, and a refusal kept in the dialog.
  - `@oppenheimer/frontend-web`: `ConfirmDialog` takes `tone="primary"` for a
    confirm that loses nothing; `destructive` stays the default.
  - `@oppenheimer/translations`: `hosts.settings.updateRunner`, `updateTitle`,
    `updateDescription`, `updating`, `updateFailed` and
    `toasts.hostUpdateRequested`.
  - `@oppenheimer/docs`: `HOSTS_008` in the error catalog.

- 5b1c52a: Bots can read and write in the owner's WhatsApp, the way OpenClaw does it.
  The runner pairs a spare number as a WhatsApp linked device (a QR code
  scanned from the phone) and keeps its keys on the host; it is never shown
  online, syncs no history, sends no read receipts and keeps a send budget of
  its own. `RUNNER_WHATSAPP=off` turns it off. The link gains the `whatsapp`
  capability and its `whatsapp.*` frames.

  The new `whatsapp` module keeps each number (`whatsapp_account`, one per
  host) and the messages it sees (`whatsapp_message`, 90 days), behind
  `GET`/`POST /v1/whatsapp/accounts` and `DELETE /v1/whatsapp/accounts/:id`
  with the `whatsapp:read`/`whatsapp:write` scopes. Bots get
  `list_whatsapp_accounts`, `list_whatsapp_chats`, `read_whatsapp_chat`,
  `search_whatsapp` and `send_whatsapp_message`, which asks unless the owner
  allowed it for that chat. Settings → WhatsApp links, pairs and unlinks.

- 4ee069d: A linked WhatsApp number answers its owner
  (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3).

  - `@oppenheimer/api`: `PATCH /v1/whatsapp/accounts/{id}` chooses the
    number's default bot. `POST …/owner` names the owner's own number, which
    the linked number sends a six-digit code to, and `POST …/owner/confirm`
    enters it: only its hash is kept, it lasts ten minutes and five wrong
    codes lock it (`WHATSAPP_011` to `WHATSAPP_014`). The confirmed owner's
    messages in their own chat wake the chat's bot, and its answer comes back
    quoting their message; "Name: …" switches the chat to the one bot of
    theirs with that name, and `/new`, `/stop` and `/help` work as plain
    text. Strangers, groups, the number's own messages and its chat with
    itself are stored and answered by nothing. The bots' answers to the owner
    do not count toward their 100 sends a day.
  - `@oppenheimer/api-client`: `updateWhatsappAccount`,
    `requestWhatsappOwner` and `confirmWhatsappOwner`; a WhatsApp account
    carries `answeringBotId`, `ownerNumber`, `ownerPendingNumber` and
    `ownerCodeExpiresAt`.
  - `@oppenheimer/translations`: `errors.byCode.WHATSAPP_011` to `WHATSAPP_014`.

### Patch Changes

- 344ce8c: Bots get built-in commands, as Claude Code has, and `/goal` is the first
  (`product/versions/mvp/25-bots.md` §4.1).

  - `@oppenheimer/api`: a message `/goal <condition>` sets the bot's goal on
    the turn it queues, with up to 20 continuations, and that turn starts on
    it. After each turn of a goal, a reviewer on the bot's own model reads the
    conversation and says met, not met or impossible; met and impossible end
    the goal with a line and the reviewer's reason, not met queues the next
    continuation with that reason. A reviewer that fails is no verdict and the
    goal goes on within its limit. `/goal` alone and `/goal clear` are refused
    as messages (`GENERIC.ARGUMENT_INVALID`). `set_goal` takes up to 20
    continuations; `bot_goal` holds a 2,000-character condition
    (`WidenBotGoals`).
  - `@oppenheimer/shared`: `BOT_BUILT_IN_COMMANDS`, `botGoalCommandOf` and
    `BOT_GOAL_CLEAR_WORDS`; `goal` is a reserved skill name;
    `BOT_GOAL_ACTIVITIES` gains `met` and `impossible`;
    `BOT_GOAL_OBJECTIVE_MAX` is 2,000, `BOT_GOAL_CONTINUATIONS_MAX` 20, and
    `BOT_GOAL_CONTINUATIONS_PERSON` is new.
  - `@oppenheimer/web`: the composer's `/` menu lists the built-ins under
    Commands before the skills; `/goal clear` stops the goal without sending
    anything, and `/goal` with no condition keeps send off. Goal lines draw
    met and impossible, and the reviewer's reason.
  - `@oppenheimer/translations`: `bots.chat.goal.needsCondition`,
    `bots.chat.event.goal.met` and `impossible`, `bots.chat.slash.builtInLabel`
    and `builtIn.goal`; `bots.chat.slash.menu` names commands too.
  - `@oppenheimer/api-client`: the goal event's `activity` and `reason`.

- 7f18bbe: A bot turn that Claude Code ended because its context filled up (autocompact
  thrashing, the window's hard limit, a prompt still too long after compacting)
  no longer reads as "Anthropic refused this request … change the message or
  the model". It fails as the new kind `context`, and the chat says the context
  filled up, that the provider refused nothing, and to have the bot read less
  at once or split the request.
- 85c11ad: Optimistic concurrency is the default write of an existing aggregate.
  `@oppenheimer/backend-ddd` adds `VersionedAggregateRoot` (the aggregate carries
  the version its row was loaded at), `writeVersioned` (one `UPDATE … WHERE id
AND version` that bumps it, or throws `VersionConflictException`,
  `GENERIC.VERSION_CONFLICT`), `TypeOrmRepositoryBase.saveVersioned` and
  `retryOnVersionConflict`. Hosts are the first module on it: a host gets a
  `version` column, a rename loaded before an unpair or an uninstall no longer
  writes `unpairedAt` back to null, and an unpair racing the machine's uninstall
  raises `HostUnpaired` and writes its timeline entry once. Rename retries once on
  a fresh read; unpair and uninstall find the host already unpaired and write
  nothing. Losing the retry too answers `HOSTS_009`.
- 1496a5f: Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
- 4ee069d: Lay the ground for a bot answering its owner on WhatsApp
  (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3),
  with Telegram answering exactly as before.

  - `@oppenheimer/api`: the `AnswerOnWhatsapp` migration gives a linked
    number its default bot (`answeringBotId`) and its owner's number and
    pending code, gives each stored WhatsApp message the order it was stored
    in (`seq`), the bot a "Name: …" switched to and whether it was the bot's
    reply, and lets a bot conversation and a turn be WhatsApp's. The pieces of
    bots-chat that were Telegram's now work for any channel: a channel's chat
    (`findChannelChat`), the conversation a message starts, Clear history,
    whether a turn can still answer, the turn-context line, an ask's answer,
    and one `deliver-channel-reply` job, which the worker also takes under the
    old `deliver-telegram-reply` name for one release. Deleting a bot that is
    a WhatsApp number's default answers `BOTS_043`.
  - `@oppenheimer/shared`: `whatsapp` is a turn origin (`BOT_CHANNEL_ORIGINS`,
    `isChannelOrigin`); the WhatsApp account carries `answeringBotId`,
    `ownerNumber`, `ownerPendingNumber` and `ownerCodeExpiresAt`, with the
    update, owner and confirm schemas; `whatsapp.send` takes an optional
    `replyTo` to quote, which an older runner ignores; `splitReplyText` cuts a
    reply for any channel.
  - `@oppenheimer/api-client`: `deleteBot` documents `BOTS_043`.
  - `@oppenheimer/translations`: `errors.byCode.BOTS_043`.
  - `@oppenheimer/runner`: the generated link vocabulary carries
    `whatsapp.send`'s `replyTo`, which the runner quotes from.

## 0.3.0

### Minor Changes

- 951a622: `GET /v1/access-grants` is paginated, and the scope resolver's grant lookup is
  one statement shape.

  - **Breaking response shape:** `GET /v1/access-grants` returned every grant in
    the organization as a bare array. It now takes `page` and `limit` (default
    20, at most 100) and answers `{ data, meta }` like the other paginated lists
    (`PaginatedAccessGrantsResponseDto`), newest first. No first-party client
    called it; an API-token script reading the array needs to read `data` and
    follow `meta.totalPages`.
  - `findActiveForPrincipals` passes the principals as two arrays through
    `unnest`, so the SQL text no longer changes with how many teams and roles a
    user has (one plan-cache and `pg_stat_statements` entry), and it still reads
    through `IDX_access_grant_lookup`.

- a0e23bd: The package exports `heyApiSdk`, its types and `applyApiClientConfig` only; the legacy `*Api` classes and the query helpers are gone, and SDK functions take the API's operation names.
- 604707a: Automations: the API gains the `automations` and `inbound-events` modules, shared gains the trigger catalog and schemas, and the client is regenerated.
- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). The `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote, are gone from the
    schema. The `STRIPE_*`
    variables leave `.env.example`.
  - `@oppenheimer/shared` drops the `billing` and `leads` scope resources and
    permission groups (so the `billing:*` and `leads:*` scopes), the
    `stripe_billing` deployment and client capability, the `Billing` subject, the
    `GET /billing/subscriptions` endpoint policy and the billing and lead schemas.
  - `@oppenheimer/api-client` drops the legacy `BillingApi` and `LeadsApi`
    services and their models, and the regenerated types no longer carry the
    removed scopes or `stripe_billing`.
  - `@oppenheimer/translations` drops the `BILLING_*` and `LEAD_*` error copy and
    the unused billing entry of the team page's permission areas.
  - `@oppenheimer/backend-core`: the capabilities registry's docs no longer use
    Stripe as their example.

- f099524: Add `HealthApi.deploymentCapabilities()`.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- c078d0d: `GET /health/capabilities` reports `hosts`, and the console's pairing surfaces mint no token when it is false.
- fc0e75d: The hosts backend for the Settings page (`product/versions/mvp/14-hosts-settings.md`).

  - `@oppenheimer/api`: a host read carries a derived `status` (`running`, `idle`,
    `offline`, `unpaired`) and `runningSessionCount`, counted by `sessions/`
    through `HostsModule.contributeUsage`. `GET /v1/hosts` leaves unpaired hosts
    out unless `include=unpaired`. Removing a host, from either end, stops the
    sessions running on it. New `GET /v1/hosts/pairing/{id}` returns the token and
    the host it paired, for Add host's "Listening for this host…".
  - `@oppenheimer/shared`: `HOST_STATUSES`, `listHostsQuerySchema`, and an
    optional `cpus` on the host facts, on both Zod entry points.
  - `@oppenheimer/api-client`: regenerated; `getPairingToken`,
    `PairingTokenStatusResponseDto`, `HostStatus`.
  - `@oppenheimer/runner`: the facts report the logical CPU count as `cpus`.
  - `@oppenheimer/api`: host metadata tables (`host_inventory`, `host_presence`,
    `host_network`, `host_event`), backfilled from `host`; the old columns stay
    until the code switches over (`product/versions/mvp/15-host-metadata.md`).
  - `@oppenheimer/api`: heartbeats write `host_presence` and, only when the
    machine changed, `host_inventory`, with the change on the host's timeline;
    host responses carry `machine`, `vitals` and `network`;
    `GET /v1/hosts/{id}/timeline`. The network a runner connects from is
    recorded and placed with DB-IP Lite (`HOSTS_GEOIP_CITY_DB`,
    `HOSTS_GEOIP_ASN_DB`, the `ip_geolocation` capability); a move to another
    country or network operator emails the owner. A daily job purges networks
    unseen for 90 days and timeline entries past 180.
  - `@oppenheimer/runner`: reports OS name, kernel, CPU model, memory, disk
    total, virtualization, cloud, time zone, boot time and service manager,
    and available memory on the heartbeat.
  - `@oppenheimer/backend-email`: `sendHostNetworkChanged` and its template.
  - `@oppenheimer/translations`: `emails.hostNetworkChanged`.

- 1a51afc: Generate the client with hey-api.
- 5bd4a8b: New session sets how a session is launched, and `POST /sessions` takes it.

  The route grows a `launch` object — model, permission level, effort — and the
  `prompt` typed into the composer. The launch is folded onto `work_session` so a
  restart can relaunch a session the way it was launched without walking its log.
  The prompt is a log entry and rides `session.create` to the host, where it
  becomes the agent's trailing argument rather than something typed at a running
  terminal — so nothing about the composer waits on the relay, and exactly one of
  the two ends ever writes `prompt.first`. It also names the session, through a
  new `openai-compatible` namer provider that covers Groq, Together, vLLM and a
  local Ollama.

  The agent catalog in `@oppenheimer/shared` grows each agent's models and the
  argv its permission levels, effort stops and first task map to, read off
  claude 2.1.278's and codex-cli 0.155.1's own `--help`.

  **Breaking, `@oppenheimer/frontend-consumer`:** `SessionEntity` was modelling one
  repository, one branch and a `running | idle | stopped` state the control plane
  had stopped sending. It carries `checkouts`, the derived `state` group and the
  stored `lifecycle` now, and `create` takes an idempotency key from its caller.

- 2dc27d2: Plan: a task board, goals and a calendar, the console rail's third item
  (`product/versions/mvp/17-plan.md`).

  - `@oppenheimer/api`: the `tasks` module (tasks, goals, the board's order,
    starting or linking a session, the attach rule) and the `calendar` module
    (personal events, read-only Google Calendar through a port, the sealed
    refresh token under `CALENDAR_TOKEN_KEY`), with the `google_calendar`
    capability, two migrations and the `Task` and `Calendar` rules on `owner`.
  - `@oppenheimer/web`: `/plan` (the board and its dialogs), `/plan/calendar`
    (the month and its layers) and `/plan/calendar/google` (Google's return),
    the Plan rail item, and "Back to task" in a session's status bar.
  - `@oppenheimer/frontend-consumer`: the `tasks` and `calendar` modules and
    their query hooks; `toCreateSessionRequest` is shared by both start paths.
  - `@oppenheimer/frontend-web`: `DateField`, `TimeField` and calendar-day
    helpers in the `i18n` concern.
  - `@oppenheimer/api-client`: regenerated for the new routes.
  - `@oppenheimer/shared`: the task, goal and calendar schemas, the `tasks` and
    `calendar` scopes and the `Task` and `Calendar` subjects.
  - `@oppenheimer/translations`: the `tasks` and `calendar` namespaces,
    `nav.plan`, the date and time field copy and the new toasts.

- 173bb4c: Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag) and a default host and agent; the slug comes from the name and never changes. Nothing is derived from a repository any more: `originGithubRepoId` is gone, and a session that names no project is listed in the workspace's **Unassigned** project, which every workspace has and which cannot be renamed or archived (`PROJECTS_008`). `POST /sessions/{id}/move` lists a session under any active project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New project is a page (`/projects/new`) that returns to New session on the project it made; the project chip starts on Unassigned, and each sidebar row gains a Move to project menu. The translations gain a `projects` namespace. `PROJECTS_004` and `SESSIONS_009` are no longer raised.
- cefbc53: Pull requests: a queue of the watched repositories' open pull requests read live from GitHub (Mine, Review requests, Watching), each in a rule-based lane with what holds it; a briefing with the path to merge, the description, the diff with line comments, and a review that approves and merges in the user's own name; watched repositories; and analytics of the review period against the one before.
- f099524: Regenerated: the problem-document schema now reaches the generated client.
- f099524: Regenerated against the tightened user endpoints.
- 8fab63d: Add server-evaluated feature flags, wired into the API and the console.

  Flags are declared in code, targeted in the database, evaluated on the server
  and read on every client from one endpoint — the shape Stripe and Revolut
  describe for their own. Ported from the Flama starter.

  - **`@oppenheimer/shared`** gains `feature-flags/`: the `FEATURE_FLAGS` catalog
    (every flag the code may read, with its kind, owner, safe default and — for
    temporary flags — expiry), the pure evaluator (ordered rules, segments,
    semver targeting on the app build, deterministic MurmurHash3 percentage
    splits bucketed by organization), and the Zod schemas for targeting writes.
    Like `agents` and `protocol` it is reached through its own subpaths, not the
    root barrel: `@oppenheimer/shared/feature-flags`, and the Zod-free
    `@oppenheimer/shared/feature-flags/catalog` for the web bundle. A `flags`
    scope group, a `FeatureFlag` subject and a `GET /feature-flags/admin`
    endpoint policy join the catalogs.
  - **`@oppenheimer/api`** gains a `feature-flags` module. Every replica holds
    all targeting in memory and evaluates without I/O, polling a cheap
    fingerprint to stay in sync and keeping its last good snapshot through a
    database blip. `GET /v1/feature-flags` serves the caller's evaluated client
    flags (signed out too); the endpoints under `/v1/feature-flags/admin`,
    `/segments` and `/changes` edit targeting, pull kill switches, manage
    segments, explain an evaluation and read the audit trail, which every change
    lands on through the outbox. `@RequireFlag('key')` gates a route on a flag,
    and token creation is now behind the `api_token_creation` kill switch. New
    error codes `FLAG_001`–`FLAG_007`. Migration `AddFeatureFlags`, every point
    in time `timestamptz`.
  - **`@oppenheimer/api-client`**: the regenerated client carries the feature
    flag operations and DTOs.
  - **`@oppenheimer/frontend-core`**: a `feature-flags` kernel module and
    `useFeatureFlag` / `useFeatureFlagValue` / `useFeatureFlags`, typed by the
    catalog, reading the API rather than PostHog. Flags are prefetched as soon as
    the session is known, persisted with the query cache, and an `experiment`
    flag records a `feature_flag_exposed` event. `OppenheimerApp.create` takes
    `featureFlags: { platform, appVersion }`.

    **Breaking:** feature flags leave the analytics port. `IAnalyticsClient` no
    longer has `getFeatureFlags` / `onFeatureFlags`, `AnalyticsService` no longer
    serves flags, `analyticsKeys.flags` is gone, and `isFlagEnabled` moved to the
    `feature-flags` module. `useFeatureFlag(key)` keeps its name but now takes a
    catalog key and reads the server's answer.

  - **`@oppenheimer/frontend-web`**: the PostHog adapter drops its flag methods
    and switches PostHog's own flag loading off.
  - **`@oppenheimer/translations`**: messages for `FLAG_001`–`FLAG_007`, and the
    control-plane copy for a flags screen (`control.flags`, `nav.featureFlags`).
  - **`@oppenheimer/web`** reports its platform and build when it asks for its
    flags.

  `pnpm check:flags` (in CI) fails on a temporary flag past its expiry date and
  on a flag the catalog declares but no code reads.

- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/versions/mvp/21-session-share-links.md`).
- ca05d90: Cheaper runner-link traffic and a keyset session list.

  - `@oppenheimer/api`: a batch of session events lands in one `INSERT` (the
    `MAX(seq)` read still runs after the row lock, in its own statement), and the
    runner's append no longer reads the session before its transaction
    (`appendEventsForHost`). A link's queued `events.append` batches for one
    session are coalesced into one append and acknowledged per `batchId`. The
    queue is bounded: the socket is paused at 64 waiting batches, resumed at 16,
    and closed with 1013 at 256 or after a 10 s pause; the keepalive does not
    terminate a link it paused. Runner frames are capped at 512 KiB by `ws`
    itself (1009). A heartbeat is one statement when the inventory is unchanged:
    `recordVitalsIfPaired` replaces `recordVitals` and the host-row read.
    `GET /v1/sessions` takes an opaque `cursor` and answers `meta.nextCursor`;
    page mode is unchanged apart from `recent`'s id tie-break now running
    descending.
  - `@oppenheimer/shared`: `listSessionsQuerySchema` takes an optional `cursor`.
  - `@oppenheimer/api-client`: regenerated — `cursor` on `listSessions`,
    `nextCursor` on `SessionPageMetaDto`, whose counts are now optional.
  - `@oppenheimer/frontend-consumer`: `SessionsRepository.findAll` walks the list
    by cursor instead of by page and count.

- f101364: Regenerated from the OpenAPI document: the eleven session operations, the archive
  operation on projects, and the session, checkout, event and attach-ticket
  response types.
- f099524: Scope arrays carry the `SCOPES` union, the permission catalog carries real DTOs and `GET /v1/users` carries `PaginatedUsersResponseDto` — previously `string[]`, `Record<string, any>[]` and `any`.

### Patch Changes

- 2063d42: A rate-limited request answers `RATE_001` with a `retryAfter` member instead of a codeless 429. `POST /v1/access-grants` returns the grant it created, instead of falling back to another grant in the organization.
- f099524: Regenerated: the documented 401/403 failures now reach the OpenAPI document.
- 669b0d3: Let one generator own every DTO name: `src/common/models/*` now re-exports the hey-api type of the same name instead of holding a second, rotting definition of it.
- 9ed9703: Regenerate against the widened scope enum, so `CreateApiTokenRequest.scopes` accepts the control plane's scopes.
- 1094480: Creating a role no longer falls back to a global role for any caller when the
  request has no organization. `POST /v1/roles` without an active organization
  still creates a global role for a platform admin (`manage all`), and answers
  `ROLE_008` (400) for anyone else instead of writing a role every tenant reads.
  The command must set `CreateRoleCommand.global` explicitly, and the handler
  checks `manage all` again before creating the role. Adds the `ROLE_008`
  message in both locales.
- 7ed4e17: The GitHub App install callback is bound to the person who started it.

  - `@oppenheimer/api`: `POST /v1/installations/install-state` (`startInstallation`)
    mints a single-use, 15-minute state bound to the caller and the workspace and
    answers the App's install URL carrying it. `POST /v1/installations` requires
    that state and spends it before GitHub is called; anything else is
    `GITHUB_011`, one code for missing, expired, reused and someone else's.
  - `@oppenheimer/shared`: `connectInstallationSchema` requires `state`
    (`installStateSchema`).
  - `@oppenheimer/api-client`: regenerated.
  - `@oppenheimer/frontend-consumer`: `useStartInstallation`, and
    `InstallationsService.connect` takes `{ githubInstallationId, code, state }`.
  - `@oppenheimer/web`: Connect GitHub and New session's Manage repository access
    mint the state on click; a callback without one is refused on screen and
    never posted. The first-run walk rides as the state's prefix.
  - `@oppenheimer/translations`: `errors.byCode.GITHUB_011`,
    `onboarding.flow.github.unstarted`, `onboarding.flow.github.starting`,
    `sessions.new.repository.manageFailed`.

- 79e30e5: Regenerate against the installation endpoints: connect, disconnect, list, and the live repository and branch listings.
- cdc6219: The probes say less and decide more strictly.

  - `GET /api/v1/health` checks nothing but that the process answers, and always
    serves `{ "status": "ok" }`. The 200 MB heap check is gone: it restarted a
    busy process at its peak.
  - `GET /api/v1/ready` checks PostgreSQL (`SELECT 1` on the app's own pool) and
    Redis (`PING`) concurrently, each within its own deadline
    (`HEALTH_DATABASE_TIMEOUT_MS`, `HEALTH_REDIS_TIMEOUT_MS`), counts
    only an explicit "up" as up, and answers
    `{ status, checks: { database, redis } }` with one word for a failure; the
    reason is logged. The heap and disk thresholds are no longer part of it.
  - **Response shape:** both bodies replace Terminus' `info`/`error`/`details`.
    Nothing in the repository read them.
  - `@nestjs/terminus` is no longer a dependency: nothing uses it.

- 8e2de68: Regenerate for the host routes: pairing tokens, registration and the host's own
  uninstall call.
- a7aa829: `GET /v1/organizations/:orgId/members/me` answers for the organization in the path (`getMembership({ path: { orgId } })`); the unused legacy `OrganizationMembersApi` class is removed.
- 2701a0c: Regenerate from the OpenAPI document: `listProjects`, `getProject`, `updateProject` and `ProjectResponseDto`.
- 2d84b28: Pull requests read GitHub under its limits and survive a refused part. Each token keeps at most four requests in flight and waits out `Retry-After` and a spent budget, and a long wait is `GITHUB_015` instead of `GITHUB_009` (#247). Analytics reads at most the 150 most recently closed pull requests and says so when there were more. A pull request whose checks GitHub refuses keeps its row with "Checks unavailable", a repository GitHub will not answer is named instead of failing the queue, and a refused permission says what to grant (#244).
- 024f31b: User and role search match `%` and `_` literally.

  - Added `likeContains(term)` to `@oppenheimer/backend-core`: an `ILIKE`
    contains-pattern with the term's `%`, `_` and `\` escaped.
  - `GET /v1/users?search=` and `GET /v1/roles?search=` use it, so `a_b` no
    longer matches `axb` and `%` no longer matches every row. `search` is trimmed
    and capped at 100 characters (documented as `maxLength` in the OpenAPI
    document; a longer term is a 400).

- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
- 064c443: `POST /sessions` takes exactly one checkout. A session with none was accepted,
  then refused by the runner at launch, which makes a session as one worktree of
  one repository; it is now refused with a 400 before a row is written.
  `CreateSessionInput.checkouts` is a one-element tuple to match.
- 1a51afc: Declare `sideEffects`.

## 0.2.0

### Minor Changes

- e209380: Add a CLI and an MCP server, both governed by granular per-credential
  permissions.

  Authorization gains a second layer. Roles say what a _person_ may do; **scopes**
  say what a _credential_ may do on their behalf, and the two are intersected on
  every request. A token can never be minted with more reach than its creator
  has, and revoking someone's role immediately narrows every credential they
  issued.

  - **`@oppenheimer/shared`**: the scope catalog — nine permission groups
    (profile, users, admin, roles, organizations, members, invitations,
    workspaces, tokens), each with a Read and an Edit level backed by the CASL
    rules it authorizes. Helpers for parsing, the write ⇒ read implication, the
    OAuth string form, and `grantableScopes`/`ungrantableScopes`, which enforce
    the "never exceed your creator" rule. Plus `ResourceScope` for per-organization
    narrowing, Zod schemas for token creation, and an `ApiToken` subject with
    own-token permissions on the seeded `user` role.

  - **`@oppenheimer/api`**: a new `api-tokens` DDD module (Better Auth 1.6 no longer
    ships an apiKey plugin). Only a SHA-256 digest of each secret is stored;
    tokens support expiry, IP allowlists and organization scoping, and are revoked
    rather than deleted. `ApiAuthGuard` replaces Better Auth's cookie-only guard
    and accepts a session cookie, an API token or an OAuth access token;
    `ScopesGuard` is registered globally and fails closed, so a route that
    declares no `@RequireScopes` cannot be reached by a token at all. The MCP
    plugin adds OAuth 2.1 discovery, dynamic client registration and a consent
    page. New endpoints: `GET|POST /v1/tokens`, `DELETE /v1/tokens/:id`,
    `GET /v1/tokens/permissions` and `GET /v1/me/credential`.

  - **`@oppenheimer/mcp`** (new): an MCP server exposing 26 tools over stdio and
    Streamable HTTP from one registry. Tools declare the scopes they need and the
    tool list is filtered by the credential's effective scopes, so an agent is
    never shown a capability that would be refused.

  - **`@oppenheimer/cli`** (new): `oppenheimer` — login that trades a session for a scoped
    token, token management with a permission catalog, users/roles/orgs/workspaces
    commands, `--json` output, profiles, and `oppenheimer mcp install` to connect an
    agent.

  Deploying runs a migration that adds the `api_token` and OAuth tables and grants
  every user permission over their own tokens. `pnpm generate:api-client` no
  longer needs a running database.
