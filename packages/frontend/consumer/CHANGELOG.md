# @oppenheimer/frontend-consumer

## 2.0.0

### Major Changes

- 3ffa099: Less boilerplate in the product package, the same behaviour.

  - Repository methods are `callApi(X, async (api) => …)`, naming their failure once; `@MapApiError` is gone and `unwrap` is no longer exported (`unwrapBody` stays).
  - Mutation hooks come from `defineMutation(useApp)({ run, invalidates | update })`; the consumer binds it as `mutation`.
  - `SessionEntity`, `PullRequestEntity` and `AutomationRunEntity` take one props object (`XProps`), set with core's `assignProps`, which keeps a field's default where a prop is undefined. `@oppenheimer/frontend-consumer/testing` builds the three for tests.
  - `ServerEventStream<TEvent>` in core is the Server-Sent Events stream `BotStream` and `WorkspaceEventStream` extend; the attach streams share their socket setup, and the device stream redials on the configured reconnect ladder.

- 70eb8ea: The persisted query cache stores only what is listed. `createQueryPersistOptions` takes `persistedFeatures` (an allow-list) instead of `nonPersistedFeatures`; the kernel keeps `featureFlags`, `capabilities` and the cache owner, a read can still opt in with `PERSIST_META`, and `CONSUMER_NON_PERSISTED_FEATURES` is now `CONSUMER_PERSISTED_FEATURES` (the permission catalog). A feature nobody listed used to be stored and came back as plain JSON: the workspace list's `createdAt` restored as a string. The cache revision moves to 5, so caches written under the old policy are dropped.

  The workspace event stream's refreshes and the polls it stands down are one table per event, and standing down is opt-in: a poll kind says `streamCanCover: true`, and only a read the stream announces in full stands down. A new poll kind, or a new read inside a feature the stream refreshes in part (a tasks read other than the list and the milestones), keeps polling.

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
- 7944eae: The bot composer recalls what you sent, as a shell does.

  - `@oppenheimer/web`: Up with the caret at the start of the field writes your
    last message into it, Up again the one before; Down walks back and, past
    the newest, gives back the draft you had, even after you edited a recalled
    message (the arrows then move the caret through it, and step only from its
    very start or end, so a long line the field wraps keeps its arrows). A send starts the walk over. The open `/` menu keeps
    the arrows for its highlight. While a sent message is in the field, the box
    says which one over it ("History 1/2").
  - `@oppenheimer/design-system-web`: `ChatComposer` takes `caption`, a quiet
    line inside the box over the field, announced as it changes.
  - `@oppenheimer/translations`: `bots.chat.history`.
  - `@oppenheimer/frontend-consumer`: `BotConversationEntity.sentTexts` (your
    messages with text, newest first, a repeat in a row once) and
    `useBotSentTexts`.

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
- a51a958: A bot can manage projects from chat (issue #647). `create_project` and
  `update_project` make a project or change its name, repositories and
  default host and agent, refusing a name another project already has unless
  the person asked for a second one; `archive_project` asks the person under
  every preset, one call at a time, and names a project's open sessions
  instead of raising a card it would refuse; `move_session` lists an existing
  session under another project, or Unassigned, keeping its id, history,
  state and worktree. Each goes through the projects' and sessions' own
  commands and the request schemas the console validates with. `get_project`
  now shows each repository's installation and repository ids.

  Making, changing or archiving a project raises `project.changed` on the
  workspace stream (`ProjectChangedDomainEvent`, staged on the outbox with the
  write), and the console re-reads its projects on it, so the sidebar shows a
  project a bot made without a reload.

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
- 0d83e40: The bot composer's `/` menu offers `/recap` under Skills, ahead of the bot's own, so you find the catch-up without knowing it is there.
- b37663a: Sending to a bot is optimistic: the message, and its turn queued, are drawn
  in the chat (or among the waiting messages, behind a running turn) the
  moment you send, and the composer empties at once. A send the API refuses
  comes back out of the chat, its words and images back in the composer.
  `useSendBotMessage` takes the message's `attachments` rather than their ids.
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

- 4faf606: A bot's chat shows the subagents of a running `delegate` call as they work.
  The bot's stream sends a `subagents` frame (each child's task, state, the
  tools it has called, its start and duration) each time one moves, keyed by
  the call's id, which the engines now hand each tool call
  (`BotEngineToolCall`). The console hangs a line per child under "Running 3
  subagents", with its clock or how it ended and a fold listing its tools,
  until the stored step replaces them. `useBotLiveText` is now `useBotLive`,
  returning `{ text, subagents }`.
- 3d54930: A bot can watch what a session's terminal prints. `watch_session` takes a
  `pattern`, which the runner matches line by line on the host (new
  `session.watch` / `session.unwatch` commands and the `terminal.matched`
  event, which carries only a count). The match wakes the bot once per new
  count, and the chat shows "Session “X” printed 3 lines matching “FAIL”". A
  wake for a task that ended says when its pattern never matched. Two more
  tools land with it. `wait_for_session` waits up to 120 s inside a turn.
  `read_session` takes `after_seq`, which `send_to_session` and
  `answer_session` now hand back, so a bot reads only what followed its own
  input. A watch sent again on a hello carries its last count, so a runner
  that restarted counts on from it. New errors are `SESSIONS_042` (invalid pattern), `SESSIONS_043`
  (10 patterns per session) and the runner's `INVALID_PATTERN`.
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

- 5dfebed: Bots dream: an offline pass of the bot's own model tidies the memory it wrote (`25-bots.md` §4.1, "Dreaming"; from Managed Agents' dreams).

  - After a turn, once the bot keeps 8 facts of its own and has written 10 since its last dream (at most daily, only while "Learn automatically" is on), a `bot-dreams` job merges duplicates, drops what is stale or contradicted, rewrites each fact as one clear sentence and adds at most five the conversation shows will matter, checked against the conversation summary and the newest messages.
  - Only the bot's own facts are rewritten; what the person wrote and what other bots share stay as they are. A merged log fact keeps its day.
  - The write is refused when the memory changed since the dream read it, and an answer that keeps too little or would overfill the memory is not used.
  - Each dream is a line in the chat. Settings → Memory shows the last one, with **Tidy now** (`POST /bots/:id/memory/dream`) and **Undo** (`POST /bots/:id/memory/dream/undo`, `BOTS_041` when there is nothing to undo), which puts the old facts back and keeps what the bot saved since.
  - `/usage` counts a dream's spend as `dream`.

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

- c7a6f7a: Employees sidebar: drag a bot group by its head to reorder the groups (saved
  as the group's position), hide a bot from the sidebar from its row menu, and
  show hidden bots again from a filter menu beside Search bots. Hidden bots are
  kept on this device; a search still finds them, and a drop next to a hidden
  bot keeps its place.
- 0044013: A Google event that is a video meeting can be joined from Plan's calendar: its dialog offers Join meeting, opening the event's Meet link, the video link a Zoom or Teams add-on attached, a location that is itself an `https:` address, or a Zoom, Meet, Teams or Webex join link pasted in the location or the description. Calendar events carry it as `meetingUrl`, null when there is none.
- 9716225: A session's chat says what Claude is doing in its own words. While it works, the foot of the chat shows Claude Code's spinner line as its terminal draws it ("✻ Mustering… (4m 31s · ↓ 15.9k tokens)"), read off the grid under the chat (`AgentActivity`, `ChatState.activity`). A command row leads with what the agent said it was for, the command after it in subtle ink. The person's turns sit on the blue wash, and inline code and the model badge are drawn on the hover wash, so they no longer vanish on the terminal's ground in dark.
- d5ebd8d: The chats fold looking around and cap long output, after Codex. In a
  session's chat a run of read-only calls (Read, Grep, Glob, LS, and a Bash
  command that only lists, reads or searches) is one "Explored" line,
  "Exploring" while it runs, naming what it looked at with each file once,
  and opening to the calls; any other call ends the run. A bot's chat does
  the same over its `get_`, `list_`, `read_` and `search_` tools and the web
  search. A call's text output shows its first five lines, a long line cut
  to its head and tail, under "+N lines". `ToolCallGroup` and `TraceGroup`
  take a `detail`; `ToolCallOutput` is new, and `TraceOutput` cuts long
  lines while it is cut and takes a `full` label.

  The fold is one pure module, `@oppenheimer/frontend-consumer`'s `chat` (`cutRuns`, `exploredParts`), and the line after the heading is the kit's `useExploredLine`.

- 419f41c: Session chat: a file a turn changed opens from its row in a viewer, as the diff of what the turn wrote to it, without leaving the chat. It shows what the transcript carried, so an edit the host cut says so. A written file's line count no longer counts the newline it ends on as a line. `DiffView` waits for the diff highlighter before it mounts, so a diff that is on screen from its first render is drawn in development too.
- f93ffbe: One chat item model for the bots chat and the session chat:
  `@oppenheimer/shared/schemas/chat-item` (a turn with its status, and items
  typed by what they are, each in progress, completed or failed), and pure
  adapters in the product package that read a bot's conversation and a Claude
  Code transcript into it. Both chats now read tool calls through one
  `classifyTool` (kind, item type, glyph name, name in words, target) in the
  product package instead of a table each. Nothing on screen changes.
- 8b529a9: A Claude Code session's chat is sent tail first. An attach sends the last 40
  turns, from the line that opens the first of them, and says where they
  start (`before`); scrolling to the top of the chat asks the host for the 40
  turns before that (`chat.older` on the attach socket, `attachment.chat.older`
  on the link, capability `attachment.chat.older`), shown with the spinner
  until the page has come. A reconnect's tail is checked against what the
  chat holds from where it starts, so older pages stay. Codex, Grok and
  OpenCode sessions still send their whole history, and so does any session
  whose console or control plane cannot ask for older turns: the browser says
  it can on the resize that starts the attach (`chatTail`), and the relay
  passes that on only to a runner that names the capability.
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

- fda123f: A host's own desktop in the console: a Desktop tab beside a session and a Desktop page per host in Settings, watching until Take control, with Full screen. The host's owner shares it with `runner desktop on`; the runner signs in to the screen-sharing server on its loopback with credentials that stay on the host, and drops the browser's input until it takes control.
- 1484bc6: The Inbox takes bulk actions. Check rows (on hover, shift-click for a run, or Select in a row's menu), then mark them all done, deprioritize, snooze or delete them from the bar that replaces the list's head. Escape clears the selection. The API marks a whole selection in one request, `POST /v1/inbox/marks/batch`, checking every key before it writes any.
- cca8cfb: The Inbox in the console (`product/versions/mvp/29-inbox.md`): a first rail item with a bell and the count of what needs you, where the console now lands (a stored rail order that lacks it gets it at the front). `/inbox` lists sessions waiting on you, bots' pending approvals, pull requests requested of you or ready to merge, and the last day's failed runs, most blocked first, filtered by type and project, with Show done and a Snoozed list; each row's menu marks it done, deprioritizes it, snoozes it or deletes it. The pane brings one item at a time as a card with its answers (Approve / Deny, Merge and Review, Run again and Open run, Open session), Later, and a log of what was done this visit. Behind the `inbox` flag.

  `@oppenheimer/frontend-consumer` adds the `inbox` module (marks, and the composition of the four reads into ordered, keyed items), `useSuspenseInbox`, `useInboxCount`, `usePutInboxMark` and `useDeleteInboxMark`, and declares itself free of side effects so the console's bundle carries only the hooks it uses. `@oppenheimer/design-system-web` adds the Inbox's parts (`InboxItem`, `InboxCard`, `InboxLogLine`, `InboxSnoozedRow`, …).

- 50c9d05: The Inbox's head has a Refresh button that reads every source again now, and while the Inbox is open it reads them all again every minute on its own, instead of waiting on a poll or a stream event that may never come.
- 7c0a70c: Inbox reports, the console (`product/versions/mvp/29-inbox.md`, "Reports"). A
  problem an unattended agent sent is one more Inbox item, `report`, read with
  its pictures and answered on its card.

  - `@oppenheimer/frontend-consumer`: `InboxReportEntity`, and on the inbox
    repository `findReports`, `readReportImage` and `answerReport`
    (`INBOX_CLIENT_004`–`006`). The open reports are the Inbox's ninth read
    (`inboxKeys.reports()`), composed as `kind: 'report'` under
    `report:<id>` with no project and every mark. `useInboxReportImages` reads
    a report's pictures as blobs; `useAnswerInboxReport` replaces the row with
    the answered report, so it leaves the list at once, and reads the reports
    again on a refusal. `inboxReport.changed` refetches the reports.
  - `@oppenheimer/web`: `InboxReportCard` in the reading pane: the sender, the
    title, the body as plain text with its line breaks, the link, the pictures
    as tiles that open whole, an answer field with Send answer, Later and
    Done. The list row, the search and a Reports option in the Type filter.
  - `@oppenheimer/frontend-web`: `useObjectUrls` moves here from the bots
    feature, now that the Inbox draws fetched pictures too.
  - `@oppenheimer/translations`: `inbox.report.*`, `inbox.type.report` and
    `inbox.from.report`.

- 35f32be: Answer a session's question or permission from its Inbox card (the console
  half of the Inbox's slice 4, `29-inbox.md`).

  - `@oppenheimer/frontend-consumer`: `decision` on `SessionEntity`,
    `answerDecision` on the sessions repository and service, and
    `useAnswerSessionDecision`, which puts the answered row in the lists and
    reads the session again on `SESSIONS_032`. A session waiting on a decision
    is the Inbox item `session:<id>:<decisionId>`; `sessionItemKey` is exported.
  - `@oppenheimer/design-system-web`: `InboxCardChoices`, `InboxQuestions`,
    `InboxQuestion`, `InboxQuestionOptions` and `InboxQuestionOption`, with
    their showcase demos.
  - `@oppenheimer/web`: the Inbox's session card answers a permission dialog
    (an option per button, in the dialog's order) and an agent's questions
    (numbered, pills, an own answer each, Send answers), keeping a refusal on
    the card.
  - `@oppenheimer/translations`: the cards' copy and the "Answered" log line.

- da6226c: Settings → Memory, at the account: what all your bots know about you, in one
  place, the way Claude's memory works. _About you_ is a text you write
  (`person_memory`, up to 4,000 characters), in the system prompt of every bot
  you made in the workspace and never changed by a bot. Under it is every fact
  about you that a bot of yours learned, naming the bot that keeps it; edit,
  move and forget act on that bot. `GET /v1/bot-memory/person` reads both and
  `PUT /v1/bot-memory/person/about` writes the text.
- 250c8d6: Plan's To do is what you mean to work on, not only what is due: a task has a To do day (`focusDate`) apart from its due date, set in the task dialog, by the dashed row or with Add tasks. To do lists what is put on the day and what is due on it, keeps unfinished work from earlier days until it is done, and keeps a task ticked done on the day it was done.
- 67df985: A project's page under Plan → Projects has a Stats view.

  - `@oppenheimer/frontend-consumer`: `TasksRepository.findStats` over
    `GET /plan/stats`, `useSuspensePlanStats`, and the `PlanStats` types.
  - `@oppenheimer/web`: an Overview / Stats switch on `/plan/projects/$projectId`
    (`?view=stats`) with a period picker (`?from=&to=`, the last eight weeks by
    default): tasks completed and created with their change against the period
    before and a weekly chart, and tokens per model and agent cost once any
    session reports them.
  - `@oppenheimer/translations`: `projects.detail.views`, `overview`, `stats`
    and `projects.stats`.

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

- d687bfd: A session read as a chat takes files on its messages. The paperclip, a paste on the chat and a drop on the pane hold them as chips over the field, under New session's rule (an image, a PDF or text, 5 MB, five at a time), and a refused one is said under it. Sending puts each file on the host, whose path the runner pastes into the agent's prompt, then the words and Enter, so the agent takes them as one message; a file that does not arrive keeps it and the words in the composer and says why. `ChatComposer`'s inline layout takes `onAttach` and `attachments`, and `ComposerFile` is the file chip `Composer` and the session chat share. `SessionChat.send` takes `withFiles`, which lets a message be files alone and waits for their paths to land before the words.
- 45604ff: A session's chat keeps its tool calls folded to their summary line, also while the agent is still in the run, with the call in flight under it. A long conversation stays quick: the chat store rebuilds only the open turn on each line (a closed turn keeps its identity, unless a result lands on one of its calls), and the view draws the latest 40 turns with "Show earlier turns" above them, opened without moving the reader. Claude Code's questions answer better: the agent's tag over each question, focus on the first option so the number keys answer at once, a lone one-choice question answered by the pick as the terminal picker does, Enter to move on from an answer in the person's own words, and answers that could not be typed stay to be sent again (`SessionChat.answer` returns whether they went). `QuestionPanel` takes `header` and `autoFocus`.
- d687bfd: A session read as a chat answers the questions Claude Code asks (`AskUserQuestion`). The questions take the composer's place, one at a time, each option picked by its row or its number, several where the agent allows them, or answered in the person's own words; Submit types the keys Claude Code's picker takes, and Dismiss is Escape. The transcript keeps what was asked and answered, or that it was dismissed, and a watcher sees that the agent is waiting. `SessionChat.answer` sends the answers, `ChatToolCall` carries `questions` and `answers`, and `QuestionPanel` takes a set of picks where several are allowed.
- aa92290: A session's chat queues what is written while the agent works and shows the room left. A message sent mid-turn waits on the composer (`SessionChat.post`), to be sent now, edited or dropped, and goes on its own when the turn ends, one at a time. Beside the model, the context meter opens to the context in tokens (with Compact) and the plan's 5-hour and weekly limits with their resets.

  The limits are Claude Code's own: the runner launches a session's Claude Code with `--settings` naming `runner statusline` as its status line, which keeps what the CLI hands it (`context_window`, `rate_limits`) by conversation and still draws the person's own status line, or `ctx · 5h · 7d` when they have none; the chat follower sends the latest as an `oppenheimer.status` entry (`ChatState.status`). The runner also keeps each answer's token counts (`message.usage`), so the context is counted off the transcript until the status line says. `ComposerContextMeter` forwards a button's props, so it can be a popover's trigger, and the composer's field is no longer remounted when something appears on top of it.

- ea93480: A Claude Code session read as a chat, a proof of concept behind
  `session_chat_view` (`product/next-steps/0.7-terminal-and-chat.md`).

  - `@oppenheimer/shared`: `attachment.chat` on the link (capability
    `attachment.chat`, `ChatEntryMaxBytes`, `ChatBatchMaxEntries`), `chat` on
    the attach socket, the `session_chat_view` release flag.
  - `@oppenheimer/runner`: while a browser is attached to a Claude Code
    session, the runner follows its transcript and sends each line compacted
    (no images, no thinking signatures, tool output and written files cut).
  - `@oppenheimer/api`: the relay hands `attachment.chat` to the attachment's
    browser, for a person the flag is on for and never through a share.
  - `@oppenheimer/frontend-consumer`: `SessionChat`, the entries read into
    turns of typed steps; `SessionStream.onChat`.
  - `@oppenheimer/web`: Terminal / Chat in a session's status bar; the chat
    draws turns, tool calls and the task list, and types into the PTY.
  - `@oppenheimer/design-system-web`: the `chat-ground` token.
  - `@oppenheimer/translations`: `sessions.chat.*`.

- 11fa44a: Deleting a session feels immediate, and a session gone from its host no
  longer gets stuck.

  - `@oppenheimer/frontend-consumer`, `@oppenheimer/web`: the sidebar drops a
    session the moment Delete is confirmed and keeps it out until its host
    resolves it. The row comes back when the close cannot happen: the API
    refuses it, the host is offline (`SESSIONS_CLIENT_019`, shown in the
    dialog), or the host has not resolved it within a minute. The "asked the
    host to delete" toast is gone. A restart's watch also ends when the
    session resolves.
  - `@oppenheimer/runner`: a close or a restart for a session this host holds
    no record of, one already closed here, or one whose worktree was deleted
    by hand closes it and reports `session.closed`, so its row resolves. A
    restart of such a session is still refused.
  - `@oppenheimer/translations`: `errors.byCode.SESSIONS_CLIENT_019`; the
    `toasts.sessionDeleteRequested` key is removed.

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
- ec96195: A session's chat shows its subagents as they work. The runner follows each
  subagent's own conversation beside the session's (Claude Code's
  `subagents/agent-<id>.jsonl` and its meta, Codex's child rollouts by
  `parent_thread_id`, OpenCode's `task` conversations through its API) and
  sends its lines marked `isSidechain` with `agentId`, plus an
  `oppenheimer.subagent` entry naming the call that started it, its kind,
  model, state and tokens. A Codex subagent's rollout is no longer taken for
  the session's own conversation. The console puts each subagent into its
  call (`ChatToolCall.subagent`) and draws calls that started subagents as a
  `SubagentRunCard`, a row each with its task, kind, model, clock, current
  activity or outcome, calls and tokens; `SubagentRow` takes `children`,
  which the row's name folds.
- c8c4f9b: Start session from a task no longer needs a repository: the Repository chip offers No repository (the default for a project with none), which on a host opens the session in the host's home folder, as Open terminal does. A cloud place still starts from a repository and says so, and an offline host holds a session with no repository, since only the host can say where its home is.
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

- 13374f0: A session's terminal can take a direct path to its host
  (`product/versions/mvp/22-direct-terminal-path.md`), behind the new
  `terminal_direct_path` release flag.

  - `@oppenheimer/runner`: answers a browser's WebRTC offer with pion and
    carries the attachment's bytes on one ordered `pty` data channel, at most
    eight per host; switches each direction at a byte offset; falls back to the
    link when the channel closes, with the tmux client repainted. The hello
    names `attachment.direct`.
  - `@oppenheimer/api`: the relay offers a direct path (with
    `RELAY_ICE_SERVERS`) to a runner that can answer, for a person the flag is
    on for, outside share links, and forwards the offer, answer, refusal and
    offsets.
  - `@oppenheimer/frontend-consumer`: the attach stream opens the data channel
    beside its socket when invited, switches at the offsets, follows a
    fallback, and stops trying after two failed channels; `onPath` says which
    path the bytes take.
  - `@oppenheimer/web`: the latency readout names the path.
  - `@oppenheimer/shared`: the signalling messages on both sockets, the
    `attachment.direct` capability and the `terminal_direct_path` flag.

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

- 1af8fa3: Settings → WhatsApp says who answers on a connected number
  (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3).

  - `@oppenheimer/web`: under each connected number, "Answers you" picks the
    bot that answers by default, or none, and "Your number" names the
    reader's own number, sends it a code from the linked one, and takes the
    code back, with Send a new code, Use another number and, once confirmed,
    Change. An expired code offers a new one, and an offline host sends none.
  - `@oppenheimer/frontend-consumer`: `WhatsappAccountEntity` carries
    `answeringBotId`, `ownerNumber`, `ownerPendingNumber`,
    `ownerCodeExpiresAt`, `ownerState` and `codeExpired(now)`;
    `WhatsappRepository` gains `answerAs`, `requestOwner` and `confirmOwner`,
    with the hooks `useAnswerWhatsappAs`, `useRequestWhatsappOwner` and
    `useConfirmWhatsappOwner`; `useSuspenseWhatsappSettings` also reads the
    reader's bots.
  - `@oppenheimer/translations`: `settings.whatsapp.answering.*` and
    `settings.whatsapp.owner.*`, in English and Spanish.
  - `@oppenheimer/shared`: `requestWhatsappOwnerSchema` and
    `confirmWhatsappOwnerSchema` no longer state English messages, so the
    console's forms say a wrong format in the reader's language.

### Patch Changes

- 0f9c3ca: A session's chat shows what a slash command the CLI answers itself printed
  (`/context`, `/cost`, `/model`) under the prompt that ran it, on the
  terminal's ground in its font with the spacing kept and the colour codes
  taken out; stderr is red. It was read only as the turn having ended, so
  `/context` showed its prompt and nothing under it, and a turn that folds
  keeps it. `SessionChat`'s turns carry it as an `output` step, and a
  session's chat items as an event of its own: the chat item model's
  `event` takes `command_output`.
- 2128771: A session chat's history says where it ends. The runner marks each batch of a history `more` until the one that reaches the transcript's end, `end`; the API relays it, and the console holds a first load until it is told, instead of guessing from the batches' size and pace. A chat full of screenshots, whose reads the runner slows making previews, is drawn once, at its end, not once per read on its way down.
- 8a8749d: A prompt reads as the person typed it. Pasted text no longer shows the
  `<pasted_content>` tags Claude Code wraps it in, and system reminders the CLI
  adds before or after the words are left out. This applies to the session chat
  and to the first message the runner reports. A message that opens with a
  reminder is no longer dropped from the chat.
- f6a81a2: Codex cloud sessions start on Codex's current cloud: in Codex's default
  environment with the repository, or in an environment id pasted from ChatGPT
  Settings → Codex Cloud. The environment picker no longer asks the host for a
  list of legacy environments (`GET /v1/hosts/:id/codex-environments` and its
  codes `SESSIONS_044`–`047` and `055` are gone); it offers Default and the id
  you paste. A host whose codex is not signed in to ChatGPT refuses the start
  with `SESS_022`.
- 48da240: The Inbox's API (`product/versions/mvp/29-inbox.md` §4). `GET /v1/bot-approvals?status=pending` reads the workspace's approvals across its bots, newest first, at most 100, each with `botId`, `botName` and `sessionId`, under `bots:read` and `IDX_bot_approval_org_status`. Every move of an approval (raised, decided, expired, run) now raises `BotApprovalChangedDomainEvent`, which the workspace stream sends as `botApproval.changed`.

  A new `inbox` module keeps a person's marks on Inbox items in `inbox_mark` (`done`, `low`, `snoozed` until a time, `deleted`; one per person, workspace and occurrence): `GET /v1/inbox/marks` (a snooze that has ended is left out), `PUT /v1/inbox/marks/:itemKey` and an idempotent `DELETE /v1/inbox/marks/:itemKey`, under the new `inbox:read` / `inbox:write` scopes, which, like `profile`, no role backs, and the `inbox` release flag. Each write sends `inboxMark.changed` to that person's streams only. Errors `INBOX_001`–`INBOX_004`.

  `@oppenheimer/shared` adds `INBOX_MARKS`, `putInboxMarkSchema`, `inboxItemKeySchema`, `findWorkspaceBotApprovalsSchema` and the two events; the console refetches `['bots', 'approvals', 'pending']` and `['inbox', 'marks']` on them.

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

- 1496a5f: Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
- 1a47694: A long session chat draws its history once, at its end, on a first load.
  The runner sends the history in batches of up to 256 entries, and the chat
  drew each one as it landed: the 40-turn window ran through the whole
  conversation, about 290 turns mounting and fading in on the way to the end,
  the view jumping as it went. The chat now holds a first load back
  (`ChatState.loading`) until its history has come: a batch shorter than the
  runner's full ones, or half a second with none. Until then the chat shows
  its frame and composer, not the empty state. A short history draws at once,
  and a reconnect's replay keeps its own check.
- 75a1594: Coming back to a session draws its chat at once: the tab keeps the chats of
  the last five sessions it read, so the history the host sends again on
  every attach changes nothing on screen where it matches. A long chat's
  earlier turns come as the reader scrolls to its top, after a spinner shows
  there a moment, instead of from a "Show earlier" button.

  A kept chat lets go of what its pane was waiting on when the pane goes
  (`SessionChat.detach`): a replay cut short keeps every line, a first load
  cut short is dropped, and messages queued in that visit are not sent in a
  later one.

- 3fd3efb: A long session chat stays light while the agent writes. Each turn subscribes
  to its own record, so a line of the transcript redraws the turn it lands in
  instead of every turn on screen (40 → 1 per line). A result that lands on an
  earlier turn's call (a background command that finished after the next
  prompt) rebuilds the chat from that turn, not from the start of the
  conversation.
- c0515d4: A session chat whose transcript is over 4MB now also draws its history once,
  at its end, on a first load. The runner reads a transcript 4MB at a time and
  ends each read on a short batch, and the chat took any short batch as the end
  of the history. On dev, a 7.8MB conversation appeared at turn 657, where the
  first read ended, then slid through the remaining 640 turns. A short batch
  now ends a first load only when it is the first one: a read that fills less
  than one batch stopped at the end of the file, so the whole history fit in
  it and the chat draws at once. Any longer history ends on the half-second
  quiet after the runner's last read.
- 8168686: A long session chat no longer empties and refills when its stream
  reconnects (the tab comes back, the network blips, the host returns). The
  runner sends the whole transcript again, in batches of up to 256 entries,
  and the chat used to start over on the first batch: it dropped to the oldest
  turns, drew every turn afresh and threw the reader to the top of the
  conversation, with the whole history drawn. A reset that carries lines is now
  checked against the lines the chat already holds. What matches stays drawn
  and nothing is published. The chat is rebuilt only from the first line that
  differs, and lines past the end of the replay are appended as usual. A replay that
  goes quiet before it has resent every line the chat holds means the
  transcript is now shorter, and the lines it did not resend are dropped.
- e1dbf21: A session's start log refreshes with the session again. While a session was
  starting, a `session.changed` refetch of its start log rejected with
  "Missing queryFn" (reported to Sentry), because the session screen's idle
  watch on the same query had left it a `skipToken`; whether to read the log is
  now `enabled`, so every observer hands the query a real `queryFn`.
- 69228fc: The workspace event stream refetches each read at most once every two seconds, the session list's own poll pace: a burst of `session.changed` events from working agents no longer sends one session-list and host-list read per event from every tab, which ran into the API's per-route limit and showed "You're sending requests too quickly" in the sidebar.
- Updated dependencies [a602949]
- Updated dependencies [7b0e91d]
- Updated dependencies [1d57cbf]
- Updated dependencies [43193e4]
- Updated dependencies [dfd07de]
- Updated dependencies [1df2b19]
- Updated dependencies [db21b92]
- Updated dependencies [344ce8c]
- Updated dependencies [d314623]
- Updated dependencies [d5d4fd4]
- Updated dependencies [c5c09d0]
- Updated dependencies [be15bdc]
- Updated dependencies [38ffaaf]
- Updated dependencies [e315b92]
- Updated dependencies [a51a958]
- Updated dependencies [b283349]
- Updated dependencies [cfa236a]
- Updated dependencies [434deea]
- Updated dependencies [0d83e40]
- Updated dependencies [9ccced3]
- Updated dependencies [6568fab]
- Updated dependencies [a7c8731]
- Updated dependencies [c4b0995]
- Updated dependencies [be941d8]
- Updated dependencies [b639f26]
- Updated dependencies [929db14]
- Updated dependencies [4faf606]
- Updated dependencies [3d54930]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
- Updated dependencies [201ee3a]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
- Updated dependencies [8deebf8]
- Updated dependencies [5dfebed]
- Updated dependencies [e338973]
- Updated dependencies [87d0f96]
- Updated dependencies [39d9703]
- Updated dependencies [59809f9]
- Updated dependencies [060dabb]
- Updated dependencies [a23f236]
- Updated dependencies [e0047a2]
- Updated dependencies [f09b6b3]
- Updated dependencies [3dbe5f1]
- Updated dependencies [629ea1d]
- Updated dependencies [bc448db]
- Updated dependencies [581c202]
- Updated dependencies [6af341b]
- Updated dependencies [0044013]
- Updated dependencies [0f9c3ca]
- Updated dependencies [2128771]
- Updated dependencies [f93ffbe]
- Updated dependencies [8b529a9]
- Updated dependencies [c11f8a3]
- Updated dependencies [8baff58]
- Updated dependencies [9f858e0]
- Updated dependencies [b39d40f]
- Updated dependencies [33cb1d8]
- Updated dependencies [55acf65]
- Updated dependencies [3230edb]
- Updated dependencies [f6a81a2]
- Updated dependencies [61f1092]
- Updated dependencies [dc67559]
- Updated dependencies [3ffa099]
- Updated dependencies [6eb8d65]
- Updated dependencies [c90bcf1]
- Updated dependencies [17e4cd5]
- Updated dependencies [d68e9c4]
- Updated dependencies [500ddd1]
- Updated dependencies [33cb1d8]
- Updated dependencies [ab9a6f4]
- Updated dependencies [aeeb48b]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [85c11ad]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [7c0a70c]
- Updated dependencies [c63402e]
- Updated dependencies [ac40af9]
- Updated dependencies [0ed584c]
- Updated dependencies [814aa6c]
- Updated dependencies [5b48b5e]
- Updated dependencies [9b0c57f]
- Updated dependencies [6bb3a80]
- Updated dependencies [a3cf769]
- Updated dependencies [a3a780b]
- Updated dependencies [1496a5f]
- Updated dependencies [70eb8ea]
- Updated dependencies [da6226c]
- Updated dependencies [3b5d381]
- Updated dependencies [9871b11]
- Updated dependencies [250c8d6]
- Updated dependencies [04188eb]
- Updated dependencies [a80436f]
- Updated dependencies [146d7d1]
- Updated dependencies [d4606c6]
- Updated dependencies [1dbae54]
- Updated dependencies [6917f62]
- Updated dependencies [8b772b8]
- Updated dependencies [d69ddc4]
- Updated dependencies [ea93480]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [1f7f57b]
- Updated dependencies [b5a9490]
- Updated dependencies [f8eda6e]
- Updated dependencies [db4ae58]
- Updated dependencies [13374f0]
- Updated dependencies [a68c88c]
- Updated dependencies [a69aa94]
- Updated dependencies [2d187ed]
- Updated dependencies [9706ce9]
- Updated dependencies [5b1c52a]
- Updated dependencies [4ee069d]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
  - @oppenheimer/shared@0.4.0
  - @oppenheimer/api-client@0.4.0
  - @oppenheimer/frontend-core@0.4.0

## 1.0.0

### Major Changes

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

### Minor Changes

- 24d217d: Add host is a dialog in the console.

  - `@oppenheimer/web`: New session's host chip opens the Add host dialog instead
    of navigating to `/onboarding/host`; the dialog owns the Command / Agent
    prompt switch, the panel and a footer that arms on a registered host.
  - `@oppenheimer/frontend-web`: new `hosts` concern with `HostPairingChrome` —
    the token line and the status row the onboarding step and the dialog both
    draw.
  - `@oppenheimer/frontend-consumer`: `useHostPairing` (in `react/hosts.pairing.ts`)
    is the pairing flow both surfaces run; it counts `secondsLeft` rather than
    formatting a clock. `useCurrentPairing`, `usePairingTokens` and `useHosts`'s
    poll are its internals and leave the barrel; the unused `usePairHost` is gone.
  - `@oppenheimer/translations`: new `hosts` namespace for the pairing copy both
    surfaces read, `sessions.new.addHost.*` for the dialog's own words, and
    `common.close`.

- db7d2f7: `frontend-consumer` gains an `automations` module and its query hooks.
- f099524: The organizations repository no longer swallows a failed read into an empty list.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- a0e23bd: Pass-through services are removed (`app.<module>` is the repository); `useHostPresence` and `refetchEverythingForNewIdentity` are added.
- bb3c4e8: `useSessionStartProgress` reads how a session's start is going: the steps its host reported, and the host's reason when it failed.
- ba9abd0: Timing and retry decisions move to `CORE_CONFIG`
  (`@oppenheimer/frontend-core/config`) and `CONSUMER_CONFIG`
  (`@oppenheimer/frontend-consumer/config`); `createQueryClient`'s `staleTime`
  now defaults to the kernel's. Values are unchanged.
- ab97201: Unused code is removed, and each barrel exports only what the console imports; `pnpm check:unused` holds it there.
- c078d0d: `GET /health/capabilities` reports `hosts`, and the console's pairing surfaces mint no token when it is false.
- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- 2202daa: A session's first task can carry images.

  - `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
  - `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
  - `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
  - `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
  - `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images to the first task.

- d5d310c: An organization's repositories can be reached from the project dialog, and a requested organization install is said rather than dropped.
- f099524: Name the product's own non-persisted queries: `CONSUMER_NON_PERSISTED_FEATURES` adds `sessions`, `hosts`, `apiTokens` and `profile`.
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

- e505b9e: A host gets the repository ready while New session is still being written:
  picking a host and a repository sends `repository.prepare`
  (`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
  spare worktree, so the create that follows starts in about a second. A first
  clone is shallow and deepened in the background, checkouts write from one
  worker per core, and session branches are cut `--no-track`.
- 0918701: `useChangeEmail` and `useDeleteAccount`; the profile repository goes through the generated SDK alone.
- 173bb4c: Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag) and a default host and agent; the slug comes from the name and never changes. Nothing is derived from a repository any more: `originGithubRepoId` is gone, and a session that names no project is listed in the workspace's **Unassigned** project, which every workspace has and which cannot be renamed or archived (`PROJECTS_008`). `POST /sessions/{id}/move` lists a session under any active project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New project is a page (`/projects/new`) that returns to New session on the project it made; the project chip starts on Unassigned, and each sidebar row gains a Move to project menu. The translations gain a `projects` namespace. `PROJECTS_004` and `SESSIONS_009` are no longer raised.
- cefbc53: Pull requests: a queue of the watched repositories' open pull requests read live from GitHub (Mine, Review requests, Watching), each in a rule-based lane with what holds it; a briefing with the path to merge, the description, the diff with line comments, and a review that approves and merges in the user's own name; watched repositories; and analytics of the review period against the one before.
- bfa1020: `installationsKeys` gains `detail`, `repositoryList` and `repository`; `repositories(id)` is now a scope, and branches are keyed `[..., 'repositories', 'detail', repoId, 'branches']`. Hosts pairing keys are `hostsKeys.pairingTokens()` (`['hosts', 'pairing', 'tokens']`, was `pairings()`) and `currentPairing(name)` (`[..., 'current', { name }]`). `useSession`, `useSessionStartProgress`, `useCheckSlug` and the installation pickers take `undefined` for an input that isn't known yet and fetch with `skipToken`. `useRegister` also invalidates `profileKeys.me()`. Mutation hooks go through `withCacheOnSuccess`.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- a566fac: A session's start says when the host is downloading the repository for the
  first time: the clone step carries `download`, and the start pane explains
  the longer wait.
- 064c443: `POST /sessions` takes exactly one checkout. A session with none was accepted,
  then refused by the runner at launch, which makes a session as one worktree of
  one repository; it is now refused with a 400 before a row is written.
  `CreateSessionInput.checkouts` is a one-element tuple to match.
- f023fd9: Opening a session from the list renders the row the cache already holds instead of waiting on a second read.
- c2288fb: A new session opens on its agent. The runner starts the agent in place of the
  pane's shell (`tmux respawn-pane`) instead of typing the line that starts it,
  and the console keeps the start's steps on screen until the agent step lands.
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/versions/mvp/21-session-share-links.md`).
- 3e6e3dc: Settings → Hosts, as `design/version1/Settings.dc.html` draws it: a page in its own frame, reached from the account menu, listing the workspace's hosts as cards (status, running sessions, OS · vCPU · runner version, connected or last seen) with inline rename, copy ID and remove, and Add a host opening inside the same frame. `HostCard`, `SettingsNav`, `PageHeader`, `RoutineSteps` and the tabbed `CodeBlock` panel now measure as the version-1 export does.
- c237a5f: The console's sidebar reorders by dragging: a project by its header among
  the others (`SortableSidebarProjectGroup`), and a session within its project
  or into another one, which moves it there. The order is kept on the device,
  and the sort menu gains Custom order, its new default.
  `useSortableGroups` tells `onChange` when a drag settles and hands `onMove`
  the value it settled on; a session write stays pending until the session
  lists have refetched.
- b336aae: The polls the workspace event stream covers stand down while it is live: every package poll goes through `usePollWhile(kind, queryKey, active)`, and one coverage table in `workspace-events.ts` says which keys stand down (sessions, their start steps, a pending pairing token) and which only catch up (presence, automation runs); they poll again the moment the stream drops. The API ends every stream on a replica whose Redis subscriber connection closes, so a console is never live and deaf, and the console refetches what the stream covers each time it comes up, the first connect included.
- 0e5fd26: A session's terminal says what to do when its host is offline, and redials
  when the host is back.

  - `@oppenheimer/frontend-consumer`: `useHostPresence` takes `watching` (polls
    only while it holds) and `select`, so a pane can watch one host on the same
    `hostPresence` poll Settings → Hosts uses.
  - `@oppenheimer/web`: `useTerminal` takes `hostId`; while the link is offline
    it watches that host and redials once a poll answered after the drop finds it
    online. The band under the terminal is the design system's
    `HostLinkChrome`: a banner while the host is away (offline, catching up,
    reconnected) with the time offline and How to fix, which opens the commands
    to copy and the link to Settings → Hosts. Retry now is offered only for a
    blip.
  - `@oppenheimer/translations`: `sessions.session.hostLink.*`; the stream's
    status words other than `closed` go.

- f099524: The api-tokens repository drops the casts the loose types forced, including a `dto as never` that was disabling type checking on the create-token body.

### Patch Changes

- edfe29d: A poll that watches something finish (a session start, a run, a pairing)
  keeps running while the tab is hidden. `LIVE_POLL` now owns that with the
  interval, and a hook spreads `pollWhile()`.
- 8875e5b: Deleting an automation from its own page goes back to the list, with the toast
  that says it was deleted, instead of leaving the browser on the page of an
  automation that no longer exists.
- 4c4db57: A deleted session leaves the sidebar once its host has closed it.
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

- 9a8fb1b: A session that is still starting is read again every two seconds until the host has opened it, so New session lands on the terminal without a reload.
- 2d84b28: Pull requests read GitHub under its limits and survive a refused part. Each token keeps at most four requests in flight and waits out `Retry-After` and a spent budget, and a long wait is `GITHUB_015` instead of `GITHUB_009` (#247). Analytics reads at most the 150 most recently closed pull requests and says so when there were more. A pull request whose checks GitHub refuses keeps its row with "Checks unavailable", a repository GitHub will not answer is named instead of failing the queue, and a refused permission says what to grant (#244).
- c412130: The Pull requests area reads the repositories you watch, and nothing until you
  watch one. The queue answers with the rows it could fill and fills more over
  the reads that follow, rather than making you wait for every part of every row;
  a pull request it has not read yet is left out instead of shown with a lane and
  a checks state nobody read. Your own pull requests are recognised from a
  personal installation when you have no stored GitHub grant. The review
  period's numbers are kept in the browser's cache, so Analytics draws them at
  once instead of a skeleton, and a quarter's chart is drawn by the week, as the
  artboard draws it. What a read could not show is one notice rather than a
  callout per repository, part and refusal.
- b32d3b8: - `@oppenheimer/frontend-core`: `useQuery` and `useQueries` that share entities across refetches.
  - `@oppenheimer/frontend-consumer`: every query hook goes through them.
  - `@oppenheimer/frontend-web`: `createDialogSlot` replaces `ConsoleDialogProvider`, `useConsoleDialog` and `useConsoleList`; `SidebarSearchField` is added.
  - `@oppenheimer/design-system-web`: `useNow` shares one timer per interval; `FieldSelect` no longer reads a ref in render.
  - `@oppenheimer/web`: fewer re-renders in the sidebars and the project dialog.
- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
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

- Updated dependencies [951a622]
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [9d7efce]
- Updated dependencies [f099524]
- Updated dependencies [a0e23bd]
- Updated dependencies [2063d42]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [669b0d3]
- Updated dependencies [669b0d3]
- Updated dependencies [a880b19]
- Updated dependencies [a0e23bd]
- Updated dependencies [9ed9703]
- Updated dependencies [7945f7e]
- Updated dependencies [1094480]
- Updated dependencies [09cea4c]
- Updated dependencies [f099524]
- Updated dependencies [ba9abd0]
- Updated dependencies [ab97201]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [cdc6219]
- Updated dependencies [c078d0d]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [88f7898]
- Updated dependencies [e717f42]
- Updated dependencies [a7aa829]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [1c2ae71]
- Updated dependencies [f099524]
- Updated dependencies [2dc27d2]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [2701a0c]
- Updated dependencies [a23b14e]
- Updated dependencies [173bb4c]
- Updated dependencies [cefbc53]
- Updated dependencies [2d84b28]
- Updated dependencies [c412130]
- Updated dependencies [bfa1020]
- Updated dependencies [9ffae03]
- Updated dependencies [b32d3b8]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [dcc5fe1]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [024f31b]
- Updated dependencies [8fab63d]
- Updated dependencies [b2fd6a1]
- Updated dependencies [a566fac]
- Updated dependencies [064c443]
- Updated dependencies [3404cd3]
- Updated dependencies [bb3c4e8]
- Updated dependencies [ca05d90]
- Updated dependencies [f101364]
- Updated dependencies [f101364]
- Updated dependencies [8f5fd3d]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [b336aae]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
  - @oppenheimer/api-client@0.3.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/frontend-core@0.3.0
