# @oppenheimer/translations

## 0.4.0

### Minor Changes

- e711f5c: Add a host leads with the agent prompt, in onboarding and in the console's
  dialog, as the 2026-10-13 design export draws it.

  - `@oppenheimer/frontend-web`: `PairingChrome` is agent first: the agent
    prompt in a card with Copy prompt (its text behind a fold), the token line
    with "Install manually instead" across from it (the install command on
    one line with its Copy, and the installer's digest), and a Connection
    list — Runner installed with its version, then Host connected with the
    machine's name and OS. The two folds are `Disclosure`s; the chrome's
    root carries `data-layout`, and each part sizes itself from it, so
    `PairingToken`, `PairingInstruction` and `PairingStatus` lose their
    `layout` prop. `PairedMachine` gains `runnerVersion`.
  - `@oppenheimer/web`: the onboarding step puts Continue, Skip for now and
    its note on one row; the dialog's copy follows the export.
  - `@oppenheimer/design-system-web`: `Disclosure`'s doc no longer names Add
    a host.
  - `@oppenheimer/web-showcase`: the Add a host demo draws the same column.
  - `@oppenheimer/translations`: `hosts.pairing` gains `manual`,
    `manualLead`, `connection`, `installWaiting`,
    `installed` and `connected`; `copyPrompt` reads "Copy prompt";
    `copyCommand` and `inspect` are removed. `hosts.add.description`,
    `onboarding.flow.host.description` and `skipNote` follow the export.

- a602949: A task an agent made waits in Plan's Inbox until its person takes it up
  (`product/design/console/inbox.md`, "Tasks an agent made").

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

- db4efe1: Ask a bot from Slack: each bot can have a Slack app of its own (bot settings → Slack), created from a manifest the console fills in, its bot token and signing secret sealed under `SLACK_TOKEN_KEY`. The owner links their Slack user with a one-time code sent in the app's DM; then a mention in a channel or a DM wakes the bot, which answers in the thread (`POST /v1/slack/events`, signed). Anyone else is ignored. A channel turn that ends on an approval card links to it, on Telegram and WhatsApp too.
- 566f850: Automation editor: each trigger card has Duplicate beside Remove, which puts a copy right under it. A new automation no longer guesses a project or picks repositories; picking a project picks none, and a GitHub trigger added before any is picked listens on all of them once they are.
- 7b5c7b3: Tasks board: pick several cards (⌘/Ctrl-click, Shift-click for a run) and delete them together from the bar that floats at the foot of the page, after one confirmation. `TaskCard` takes `selected`, and `TaskSelectionBar` is the new toolbar.
- c9aa79c: Tasks board: drag from the board's empty space to draw a rectangle that picks every card it touches. ⌘, Ctrl or Shift held at the press adds to what is picked; a click on empty space clears it. Picked cards move together: drag one and the rest follow under it, or use Move to in the selection bar to send them all to a column's foot. `TaskMarquee` is the new rectangle.
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
- 43193e4: A bot babysits the work it hands off. The stall check five minutes after
  `start_session` or `send_to_session` is now the first of up to six checks:
  while the task runs, the bot is woken every ten minutes to read what the
  agent has done against its task, ends quietly (`nothing_to_report`) when it
  is on track, and tells the person when the agent went idle, loops, drifts,
  waits or fails. The chat shows "Checked on session “X”" (a new `progress`
  session event state). Asked to monitor a session, a bot now looks at once.
- dfd07de: Settings → Skills lists the skills Oppenheimer gives every bot (`oppenheimer`
  and `recap`) in a read-only "Built in" group under the bot's own, so a bot
  saying it used one points at something the person can find. A view opens
  each one's instructions; there is no edit or delete. The words moved to
  `@oppenheimer/shared` (`BOT_BUILT_IN_SKILL_TEXTS`), which the API reads too.
- e75f5fd: A bot's chat reaches its whole history: scrolled to the top, the console reads the page of messages older than what it shows and lays it above, keeping your place, until the chat's first message. Until now the chat only ever showed its newest 100 messages, so a bot whose routine writes every half hour hid the conversation behind it. `GET /bots/:id/conversation` takes `before` (a message id, the oldest the reader holds) for the page older than it, and answers `hasOlder`.
- bb76bed: A bot checks back on anything it delegated or waits on. Its new `check_back`
  tool (`about`, optional `minutes`; never asks, scope `bots:write`) wakes it
  later with a turn of its own (origin `check_back`, background lane) to look
  at a session, a pull request, a deploy, a person or a cloud run: at the time
  it names, or on a backoff of 5, 10, 20, 40, 80 minutes then every 120, one
  look a turn, for 24 hours from the first. A look's own call goes on with
  its chain; once the thing is done the bot stops calling and the chain ends.
  The look is a delayed job on the new `bot-check-backs` queue, its turn keyed
  `check_back:<chain>:<step>` so a retry wakes the bot once. The chat opens
  each look with "Checked back on: …" (a new `check_back` event kind), and
  the system prompt now has a bot call `check_back` whenever it says it will
  check, report or carry on later.
- 1df2b19: Long pastes in a bot's chat, the way Claude Code and Codex hold them.

  - `@oppenheimer/web`: the bot composer holds a paste over 1,000 characters or
    10 lines as one label, `[Pasted text #1 +1000 lines]`, and sends the pasted
    text in its place; Backspace or Delete takes a label out whole. A message
    longer than a bot takes keeps send off and says so. A long message you sent
    is folded in the chat to its first twelve lines, with Show all.
  - `@oppenheimer/shared`: `BOT_MESSAGE_MAX` is 80,000 characters (was 16,000),
    room for a pasted log of a thousand lines or more, and never larger than the
    history a turn re-sends.
  - `@oppenheimer/api`: the JSON body limit is 512 KB (was Express's 100 KB), so a
    message at that length reaches the API.
  - `@oppenheimer/backend-core`: `SanitizePipe` strips tags with a linear scan;
    its regex took quadratic time on a body of unclosed `<`.
  - `@oppenheimer/mcp`: `ask_bot` takes the same longer message.
  - `@oppenheimer/translations`: `bots.chat.pasted`, `bots.chat.fold`,
    `bots.chat.tooLong`.

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

- 4c75b47: A bot can ask its owner to fill a form. `ask_form` puts a title, a line on
  what it is for, one to eight typed fields (`text`, `textarea`, `number` with
  bounds, `select`, `email`, `date`) and the button's word on a card of its
  own, and ends the turn, the way `ask_user` does. The form is a `bot_form`
  row: `GET /v1/bots/:id/form` reads the waiting one, and
  `POST /v1/bots/:id/forms/:formId/submit` and `/dismiss` decide it
  (`BOTS_046` to `BOTS_048`); the values are read against the fields, and a
  bot has one card up at a time of any kind. The next turn, of origin
  `question`, is told each value fenced as data, and the chat draws a `form`
  event with each field's label over the value sent. The console fills it with
  React Hook Form over `botFormInputSchema`, checking each field as it is
  left, and says "Sent" for a moment before the record takes its place.
- 344ce8c: Bots get built-in commands, as Claude Code has, and `/goal` is the first
  (`product/design/bots/bots.md` §4.1).

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
  (`product/design/bots/bots.md` §4.1).

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
- b6576e2: A bot can follow a project's tasks, or one milestone's. `watch_project
{ project_id, events?, purpose? }` and `watch_milestone { milestone_id,
events?, purpose? }` subscribe it, and their `unwatch_` pairs stop it;
  `list_watches` lists them beside sessions and pull requests. Each change
  Plan logs on a task there that the bot named in `events` wakes it with one
  queued turn: by default a task added, moved column, done, reopened, blocked,
  unblocked or deleted (`BOT_TASK_WAKE_DEFAULT`), and on request a new due
  date, a move to another project or milestone, or a session attached. The
  wake names the task, its title (fenced), the columns and whether the person
  made it, never its notes. A change the bot made itself never wakes it, and
  there is no wake limit. A milestone deleted deletes its subscriptions; one
  whose owner can no longer read the project or milestone ends at its next
  wake.

  A task now raises `TaskActivityLoggedDomainEvent` for each change its write
  logs to `plan_event`, in the same transaction. `bot_subscription` gains the
  `project` and `milestone` kinds and a `taskEvents` list, held to the kind by
  `CHK_bot_subscription_subject`. The chat draws the wake as one line, "“Ship
  the docs” moved from Not started to In progress", from a new `task` event
  kind.

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
- 6568fab: `/schedule`, the fourth built-in command for bots
  (`product/design/bots/bots.md` §4.1): the bot saves a routine from the
  person's words, what to do and when.

  - `@oppenheimer/shared`: `schedule` joins `BOT_BUILT_IN_COMMANDS`;
    `botScheduleCommandOf` reads `/schedule <request>` and `/schedule` alone.
  - `@oppenheimer/api`: the turn of `/schedule <request>` tells the bot to save
    the routine with `update_routine`, pointing a request for minutes at
    `/loop`; in that turn a `create` raises no card (`routineCallAsks`), read
    from the command the turn ran (`BotToolCallContext.ranCommand`).
    `/schedule` alone is refused as a message.
  - `@oppenheimer/web`: `/schedule` in the `/` menu; `/schedule` alone opens
    the bot's Routines tab.
  - `@oppenheimer/translations`: `bots.chat.slash.builtIn.schedule`.

- be941d8: Skills for bots, run as slash commands (`product/design/bots/bots.md` §4.1).

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
- 4201798: The `/usage` card is drawn like Claude Code's small usage card
  (`product/design/bots/bots.md` §4.1).

  - `@oppenheimer/web`: the command as a bubble, then a 384px card with Copy
    and Close: the plan's 5-hour and weekly windows as bars on a sign-in that
    reports them, this chat's figures in a grid (time active, turns, cache
    hit, tokens, each model's share) and the breakdown of input, output,
    cache read and cache write, with the calls outside its turns named.
  - `@oppenheimer/translations`: `bots.chat.usage.*` are labels now
    (`thisChat`, `breakdown`, `active`, `turns`, `cacheHit`, `tokens`,
    `models`, `input`, `output`, `cacheRead`, `cacheWrite`); `since`,
    `summary` and `modelShare` are gone.

- 8fc6c25: `/usage`, the second built-in command for bots: a card of what the chat has
  spent, in tokens (`product/design/bots/bots.md` §4.1).

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

- f46ca03: A bot can be asked on GitHub. The workspace owner's `@oppenheimer <bot>`
  in a pull request or issue comment or review, or the label `bot:<bot>`,
  queues a background turn of that bot (origin `github`) with what was
  written as untrusted data, and the turn's last words are posted back there
  as one comment by the GitHub App (`AddAppIssueCommentCommand`), which wakes
  nothing of ours. Anyone else's mention or label does nothing. The bot's
  chat shows a `github_ask` line linking to the ask. Comment events now carry
  `isPullRequest`, and the workspace lookup answers a workspace's owner.
- 201ee3a: A bot's chat queues what you write while it works and shows the room it has
  left. Each waiting message sits over the composer with Remove, Edit and Send
  now. The engines report the context of a turn's last answer (with the
  model's window on the Claude engine) and, on a ChatGPT sign-in, the plan's
  5-hour and weekly windows from the Codex usage headers; each turn keeps them
  (`contextTokens`, `contextWindow`, `planLimits`) and the composer's meter,
  now the platform kit's `ChatUsage` shared with the session chat, reads the
  newest.
- 5dfebed: Bots dream: an offline pass of the bot's own model tidies the memory it wrote (`bots.md` §4.1, "Dreaming"; from Managed Agents' dreams).

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

- 581c202: Bot settings polish (`product/design/bots/bots.md`, 2026-10-16).

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
- fcb29f7: A bot's sidebar row reads as a session's. Waiting on you (an approval or questions pending, or a failed turn since you last read the chat) is the amber dot; working (a turn queued or running) shimmers the name; a message you have not read, or the row's own Mark as unread, is the blue dot. `GET /v1/bot-activity` lists the bots working and waiting on you; `POST /v1/bots/:id/acknowledge` reads a bot's chat (`bot."acknowledgedAt"`, added by a migration and backfilled to each bot's last message), and each bot carries `unread`. A turn queued or ended raises `BotTurnChangedDomainEvent`, sent on the workspace stream as `botTurn.changed { id, botId }`. `BotItem` takes `working` for the shimmer apart from `live`, its green dot.
- 0044013: A Google event that is a video meeting can be joined from Plan's calendar: its dialog offers Join meeting, opening the event's Meet link, the video link a Zoom or Teams add-on attached, a location that is itself an `https:` address, or a Zoom, Meet, Teams or Webex join link pasted in the location or the description. Calendar events carry it as `meetingUrl`, null when there is none.
- 300363e: The session chat shows the feedback report Claude Code's agent drafted, read off the card over its input box, with Review, Send and Dismiss (and the follow-up confirmations) typing the card's own keys; Review switches to the terminal, where the draft's editor opens.
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
- b39d40f: Claude Code's model list matches Claude's own picker: Opus 5.5, Fable 5.1, Sonnet 5.5 and Haiku 5.5, then Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8, Opus 4.7, Opus 4.6 and Sonnet 4.6 behind a "More models" row in the engine button.
- 55acf65: A reply typed in a Claude Code cloud session's chat wakes the session when
  it is idle (`product/design/sessions/cloud-agents.md`, "Waking an idle session").

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
- 0fed04c: A session's chat shows what a running command last printed, and marks a
  move to another model.

  - `@oppenheimer/frontend-consumer`: `readAgentActivity` also reads the
    shell call in flight above Claude Code's spinner, its last three lines
    (600 characters at most) as `ChatActivity.tail` (`readCommandTail`), off
    the screen of its inline renderer; its fullscreen renderer shows no
    output, so nothing is read there. A transcript line on another model
    than the agent last answered on brings a `model` step before what it
    wrote; Claude Code's `<synthetic>` lines name no model.
  - `@oppenheimer/web`: the running command's live row has the tail under
    it, for that command only, until its result lands; a model change is a
    `ChatMarker` ("Model changed to Haiku 5"), kept when the turn folds.
  - `@oppenheimer/design-system-web`: `ToolCallTail`, a three-line window
    of a command's last output under its `ToolCallLive`.
  - `@oppenheimer/translations`: `sessions.chat.notice.model`.
  - `@oppenheimer/web-showcase`: the Work and tools demo draws a tail.

- ca796db: Every composer completes emoji: typing `:` and two letters (`:hap`) opens a
  menu of the emoji whose GitHub shortcode or tag matches, the way Claude Code
  on the web does; Up and Down move, Tab or Enter puts the emoji in the
  shortcode's place, Escape closes it.

  - `@oppenheimer/web`: the bot chat's box, a session chat's box, New session's
    box and the second agent's box open the menu.
  - `@oppenheimer/frontend-web`: `useEmojiMenu` and `ComposerEmojiMenu`; the
    emoji list (`gemoji`) is its own chunk, fetched the first time a shortcode
    is typed. `useCommandMenu` takes any row with an `id`, not only a slash
    command.
  - `@oppenheimer/translations`: `common.chat.emoji.menu` and `.pick`.

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
- 3666563: A bot's routine can be edited by hand from its Routines tab
  (`product/design/bots/bot-routines.md` §7, changed 2026-11-21).

  - `@oppenheimer/api`: `PATCH /v1/bots/:id/routines/:routineId` takes `name`
    and `prompt` beside `enabled` (any of them, at least one). A name or prompt
    change takes the editing credential's scopes, as `update_routine` does.
  - `@oppenheimer/shared`: `botRoutineTaskSchema`, `BOT_ROUTINE_NAME_MAX`,
    `BOT_ROUTINE_PROMPT_MAX`; `updateBotRoutineSchema` widened; the bundled guide.
  - `@oppenheimer/api-client`: regenerated.
  - `@oppenheimer/frontend-consumer`: `useUpdateBotRoutine`.
  - `@oppenheimer/web`: the card's pencil opens Edit routine (name, prompt, and
    when it runs read-only with Ask in chat) instead of going to the chat.
  - `@oppenheimer/translations`: `bots.settings.routines.dialog.*`; `edit` reads
    "Edit routine".

- acb27dc: A session whose start failed offers **Open a terminal on <host>** beside Try
  again while the host is online: a blank terminal in the host's home, where the
  fix is made (`claude auth login`, an install) before trying again.

  - `@oppenheimer/web`: `SessionRetryStart` takes the host and draws the button.
  - `@oppenheimer/translations`: `sessions.provisioning.openTerminal` and
    `openTerminalTitle`.

- caa731f: A folded Bots heading keeps its bots' faces beside the label: each opens its chat and carries the state its row would (amber when it needs you, blue when unread, breathing while it works), and a `+N` chip unfolds the list when they do not all fit. The design system adds `BotFaces` and `BotFaceItem`, and `SidebarListHead` takes a `summary`.
- d68e9c4: New session's folder picker searches the host by name
  (`product/design/sessions/session-places.md` §4).

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

- 3e1fa7d: A view-only guest on a shared session can scroll its terminal back. Its
  wheel never reaches tmux (a read-only client), and tmux's copy mode is the
  pane's, so scrolling there would move the owner's view: the guest's first
  notch up asks the host for the pane's scrollback instead (`history.ask` on
  the attach socket, `attachment.history` on the link, capability
  `attachment.history`), read with `capture-pane -e` (up to 5,000 lines, its
  last 384 KiB), and the console draws it over the live grid with its
  colours. Scrolling to its end, Escape or Back to live returns to the live
  pane, which never stopped following.
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
  (`product/design/sessions/hidden-sessions.md`).

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
- cca8cfb: The Inbox in the console (`product/design/console/inbox.md`): a first rail item with a bell and the count of what needs you, where the console now lands (a stored rail order that lacks it gets it at the front). `/inbox` lists sessions waiting on you, bots' pending approvals, pull requests requested of you or ready to merge, and the last day's failed runs, most blocked first, filtered by type and project, with Show done and a Snoozed list; each row's menu marks it done, deprioritizes it, snoozes it or deletes it. The pane brings one item at a time as a card with its answers (Approve / Deny, Merge and Review, Run again and Open run, Open session), Later, and a log of what was done this visit. Behind the `inbox` flag.

  `@oppenheimer/frontend-consumer` adds the `inbox` module (marks, and the composition of the four reads into ordered, keyed items), `useSuspenseInbox`, `useInboxCount`, `usePutInboxMark` and `useDeleteInboxMark`, and declares itself free of side effects so the console's bundle carries only the hooks it uses. `@oppenheimer/design-system-web` adds the Inbox's parts (`InboxItem`, `InboxCard`, `InboxLogLine`, `InboxSnoozedRow`, …).

- 60fe272: The Inbox leaves Plan for a page of its own, the rail's first item, and its
  reading pane becomes a deck answered by number keys or a swipe
  (`product/design/console/inbox.md`, "Its own page, and a deck").

  - `@oppenheimer/web`: `/inbox` is the Inbox (`/plan/inbox` redirects there);
    the rail leads with it, with a dot and the count of what needs you, and the
    console lands on it; it has no sidebar (`sidebar: 'none'`). Plan's
    sidebar drops it and Plan opens on its board. On the deck a card shows
    only its answers, numbered for 1–9, and a dock under it has Previous, Done
    and Next (K, E, J, a swipe left and right); a card that waits on an answer
    has no Done; a questionnaire goes one question at a time; the next card
    takes the place of the one that left, and the bar over it shows the
    visit's progress. Mark as done takes up a task an agent made.
  - `@oppenheimer/design-system-web`: `InboxDeck` (the card on its stack, the
    swipe, the answers' numbers), `InboxDock`, `InboxQuestionSteps`,
    `InboxAnswerSummary`, `inboxDeckAnswer`, and `InboxToolbar`'s `progress`.
    `InboxMessageActions` takes only the answers, as rows (no `leading`), and
    `InboxQuestionOption` is a row.
  - `@oppenheimer/frontend-web`: a route's `sidebar: 'none'` leaves the shell's
    sidebar out.
  - `@oppenheimer/translations`: `nav.inbox`, `inbox.dock.*`, `inbox.question.*`,
    and `inbox.pane.cleared`; `tasks.nav.inbox` and the cards' Later, Done and
    Dismiss labels are gone.
  - `@oppenheimer/shared`: the bundled guide, after the docs' Inbox, overview,
    FAQ and Plan pages.

- 50c9d05: The Inbox's head has a Refresh button that reads every source again now, and while the Inbox is open it reads them all again every minute on its own, instead of waiting on a poll or a stream event that may never come.
- 7c0a70c: Inbox reports, the console (`product/design/console/inbox.md`, "Reports"). A
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

- c63402e: Answer a session's question or permission from anywhere but its terminal
  (the server half of the Inbox's slice 4, `inbox.md`).

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

- 4bc2e95: Mark a session unread from its row's menu to come back to it later: the row
  keeps a blue dot, on this device, until the session is opened.
- 2214b16: A reply's Markdown draws diagrams and typesets math, in both chats and
  everywhere else `Markdown` renders.

  - `@oppenheimer/frontend-web`: a closed `mermaid` fence is a diagram, drawn
    by Mermaid in strict mode in the theme's own colours and type (redrawn
    when the theme switches) and shown through `<img>`; a quiet sketch of
    nodes holds its room while it draws, a hover toolbar switches to the
    source, copies it or opens the diagram large with zoom and pan, and a wide
    one scrolls inside its frame. A source Mermaid cannot read shows as the
    code block with a note. `$…$`, `$$…$$` and a `math` fence are typeset by
    KaTeX, with prices ("$5 and $10") left as text and bad TeX shown as code;
    `MarkdownLine` shows a formula's TeX as a code span. A fence still being
    written stays code, and the caller's `code` renderer never sees a diagram
    or a formula. Mermaid, KaTeX and KaTeX's stylesheet and fonts load on
    first use, in their own chunks.
  - `@oppenheimer/design-system-web`: `animate-diagram-in`, a fade and the
    last 1.5% of scale for a picture settling into its frame.
  - `@oppenheimer/translations`: `common.markdown.diagram.*`.
  - `@oppenheimer/web`: fonts are never inlined as `data:` URIs, which the
    console's `font-src 'self'` refuses.

- 276f5f1: Bring back the Expo app for 0.5 as a shell drawn from the version-1 export's
  `Mobile.dc.html`, in native Liquid Glass on iOS 26.

  - `@oppenheimer/mobile`: the welcome screen (the portrait, Google, GitHub or
    email), email sign-in, password reset, and the console rail's five sections
    in its order (Sessions, Plan, Employees, Automations, Pull requests) in the
    system's tab bar, each saying it is coming; Account, a sheet from the
    avatar on every tab, shows who is signed in, light or dark, the language, and signs
    out. The whole auth flow: Create account (email or a provider), the
    workspace step (name and address, checked as typed) and Ready, with Terms
    and Privacy on Welcome opening the console's pages.
  - `@oppenheimer/frontend-mobile`: `AuthLayout` is the export's frame (large
    title under the native header, a footer); `BrandLogo`, `BrandGlyph` and
    `ThemeToggle` are gone; `TabScreen` and `TabPlaceholder` (the tab
    bar is expo-router's `NativeTabs`); `LanguageSwitcher` is a native select;
    the reset form checks the two passwords match in its schema, as the web
    does, and the live password checklist is gone; RevenueCat, Sentry,
    PostHog and remote config are dropped; i18n reads the `index.json`
    catalogs; tokens follow the console's palette.
  - `@oppenheimer/design-system-mobile`: `Glass` (Apple's `UIGlassEffect` on
    iOS 26, the system blur elsewhere); `Select` is now the platform's menu
    picker over `@expo/ui`, replacing the drawn rn-primitives select;
    `useDebouncedValue`; `Text` gains the export's
    `largeTitle`, `body`, `subhead`, `caption` and `overline` variants and a
    `tone` (`success` among them); `MobileRoot` runs on the npm `@gorhom` packages.
  - `@oppenheimer/translations`: `auth.login` gains `continueWithEmail`,
    `emailTitle` and `emailDescription`; `auth.register.phoneDescription`;
    `onboarding.flow.ready.onComputer` and `open`;
    `auth.forgotPassword.notReceived`, `common.error`, and `nav.account`,
    `nav.pullRequestsShort`; `common.comingToMobile`.
  - `@oppenheimer/api`: when `MOBILE_SCHEME` is set (opt-in, no default),
    Better Auth trusts `${MOBILE_SCHEME}://` and loads the Expo plugin, so the
    app's sign-in and reset links come back to it; a deployment that does not
    set it trusts no app scheme.

- be38e84: The phone's Automations tab, as `Mobile.dc.html` draws it.

  - `@oppenheimer/mobile`:
    - **The list:** every automation on one card, with its trigger in words, how its last run went, and the system's switch that pauses it.
    - **An automation's page:** Active and its next run (or why it is paused), the trigger, the instructions, where it runs, and its recent runs. Run now sits in glass at the foot. The system's ··· menu has Run now, Pause or Resume, Duplicate, and Delete behind the system's alert.
  - `@oppenheimer/frontend-consumer`: an automation's words move here, beside the automations module, so both apps say them the same way: its trigger (`triggerListText`, `scheduleText`, `daysText`, `eventLabel`, …, from the web kit) and its status (`runState`, `nextRunText`, `nextInstantText`, `pausedReasonText`, `automationAgentText`, from the console's automations feature).
  - `@oppenheimer/frontend-core`: the date helpers that wording rests on (`dateFormatter`, `viewerTimeZone`, `wallClock`, `weekdayDate`, `clock`, `dayOffset`) move down from the web kit, as product-free `Intl` formatting.
  - `@oppenheimer/frontend-web`: re-exports the date helpers the console reads from the kernel; the trigger wording is no longer the kit's.
  - `@oppenheimer/web`: imports the trigger and status wording from the product package, and `clock` and `dayOffset` from the kit rather than the automations feature's own `lib/time.ts`. Nothing the console shows changes.
  - `@oppenheimer/translations`: `automations.mobile.*`; `common.comingToMobile.automations` is gone.

- 00bcee3: The phone's Plan tab: your tasks, as the console's board lays them out.

  - `@oppenheimer/mobile`:
    - **The tab:** the four columns in order on one list. Done keeps the past week, and the rest is a tap away. The project is picked in the system's picker, the counts sit under the title, and Add task is at the foot of Not started. Each row has its done check, where it is filed, its due date, and its session line, which opens the session.
    - **A task's page:** its notes, its column (the system's picker), project, milestone, due date, and its sessions. Delete sits behind the system's alert.
  - `@oppenheimer/frontend-consumer`: these move here from the console's tasks feature, so both apps read and word a board the same way:
    - the board's columns and counts (`boardColumnsOf`, `boardCounts`, `columnOf`, `doneCutoffOf`, `filingOf`, …);
    - a task's card in words (`cardView`, `dueDayLabel`, `TaskDueTone`);
    - its session line (`sessionLineOf`, `taskSessionsOf`, `sessionStateOf`, `mostUrgent`).
  - `@oppenheimer/frontend-core`: `todayIn`, `daysBetween` and `nearDay`, calendar-day arithmetic in no timezone, move down from the web kit.
  - `@oppenheimer/frontend-web`: re-exports `todayIn`; `daysBetween` and `nearDay` are no longer the kit's.
  - `@oppenheimer/web`: imports the board, card and session-line helpers from the product package. Nothing the console shows changes.
  - `@oppenheimer/translations`: `tasks.mobile.*`; `common.comingToMobile.plan` is gone.

- fdefa41: A session opens on the phone, and the Employees tab lists your bots, each opening its chat (`Mobile.dc.html`).

  - `@oppenheimer/mobile`:
    - **A session:** its name and state in the navigation bar with a ··· menu (Share link; Delete session behind the system's alert). The system's segmented Terminal / Chat switch over the session's stream. A glass dock with what the agent waits on (answered through the API), the keys a phone keyboard lacks, and a reply line. The terminal is drawn natively from `@xterm/headless`. One not live says what can be done: Retry, Restart, or open its cloud run.
    - **Employees:** search, each group with its bots, a row per bot opening its chat. The chat streams as the console's does; the dock carries the approval (with the decisions the API offers) or question the bot waits on, and the message field.
  - `@oppenheimer/frontend-mobile`: `ListGroup`, the grouped card both lists draw. `crypto.randomUUID` and `getRandomValues` come from `expo-crypto` where Hermes has none.
  - `@oppenheimer/frontend-consumer`: `botGroupSections` and `approvalDecisionLooks` move here from the console, so both apps group bots and offer approvals the same way. A bot's stream dials through the platform's event source when one is bound.
  - `@oppenheimer/design-system-mobile`: the eight bot avatar colours.
  - `@oppenheimer/web`: imports those two from the product package; nothing the console shows changes.
  - `@oppenheimer/translations`: `sessions.mobile.*` and `bots.mobile.*`.

- 2d90527: The phone's Sessions tab lists your sessions, as `Mobile.dc.html` draws them.

  - `@oppenheimer/mobile`: search, the All / Needs input / Running / Failed
    chips with their counts, then the sessions waiting on you (what each asks
    under its name), then the rest by project; each row the agent, its state's
    dot, where it runs and its age.
  - `@oppenheimer/frontend-consumer`: `groupByProject`, `matchesQuery` and
    `stateWordFor` move here from the console's sessions feature, so both apps
    group, search and word a session the same way.
  - `@oppenheimer/web`: imports those three from the product package; nothing
    the console shows changes.
  - `@oppenheimer/frontend-mobile`: `formatAge`, the console's compact ages.
  - `@oppenheimer/design-system-mobile`: `useNow`.
  - `@oppenheimer/translations`: `sessions.sidebar.noSessionsPhone`;
    `common.comingToMobile.sessions` is gone.

- fa1a47b: No page breadcrumbs in the console: a page under a parent opens on a Back
  pill alone.

  - `@oppenheimer/web`: a project's page opens with the Back pill to Projects
    instead of a breadcrumb; an automation, Add a host and a host's Desktop
    drop the breadcrumb under their Back pill.
  - `@oppenheimer/design-system-web`: `PageHeaderCrumbs` and `PageHeaderHere`
    are removed.
  - `@oppenheimer/web-showcase`: the PageHeader demos lose their crumbs.
  - `@oppenheimer/translations`: `common.breadcrumb`,
    `automations.detail.crumb` and `hosts.add.crumbHosts` are removed.

- 749cf21: When Claude Code or Codex stops to ask permission for a tool, the session chat answers it in the composer's place: the command (coloured, under the agent's own description), or the file and a short diff of the edit, then Allow once, Always allow (in the agent's own words for what it would stop asking about) and Deny, with 1–3, Enter and Esc as in the terminal and Deny with a note. A command that deletes a tree or rewrites shared history tints the card amber. The dialog is read off the terminal with each agent's spec beside the question keys (`permissionPromptOf`, `permissionChoiceKeys` in `@oppenheimer/shared/sessions`); an agent with none keeps the status line. `ApprovalPanel` takes `tone`, `picked`, `disabled`, `autoFocus`, `foot` and `onDismiss`.
- da6226c: Settings → Memory, at the account: what all your bots know about you, in one
  place, the way Claude's memory works. _About you_ is a text you write
  (`person_memory`, up to 4,000 characters), in the system prompt of every bot
  you made in the workspace and never changed by a bot. Under it is every fact
  about you that a bot of yours learned, naming the bot that keeps it; edit,
  move and forget act on that bot. `GET /v1/bot-memory/person` reads both and
  `PUT /v1/bot-memory/person/about` writes the text.
- a6d67d7: Plan's calendar and tasks follow the 2026-11-08 `Tasks` frame.

  - `@oppenheimer/web`: the calendar opens on Day, with Week and Month beside
    it (`?view=`, `?date=`): the hours from 07:00 to 22:00 under an All day
    row, where an event or a task due at a time is dropped on a half hour to
    move there, and an empty half hour opens New event at that time. Plan
    gains To do (`/plan/todo`), one day's tasks with what is overdue, ticked
    and added in place.
  - `@oppenheimer/design-system-web`: `AgendaCalendar` (with `agendaSlot` and
    `agendaSlotId`) and `TodoRow`, `TodoRowAdd`, `TodoRowSkeleton`;
    `MonthCalendar` takes `onOpenDay`.
  - `@oppenheimer/frontend-web`: `isoWeek`.
  - `@oppenheimer/translations`: `calendar.header` gains the views and the
    week eyebrows, `calendar.grid.allDay`; `tasks.nav.todo` and `tasks.todo`.
  - `@oppenheimer/web-showcase`: the AgendaCalendar and TodoRow demos.

- 9871b11: Plan's board drops the Later column and gains In review, between In
  progress and Done: `TASK_STATUSES` is `todo`, `doing`, `review`, `done`.
  A migration moves every task in Later to the end of To do, in its order,
  and bumps its version. Attaching a session still moves a task in To do to
  In progress. The CLI's and MCP server's status choices, the bots' plan
  tools and `tasks.columns` follow.
- bf71f50: Plan's tasks have a priority: Urgent, High, Medium or Low, or none (the default). The task dialog has a Priority row, a card shows it with Linear's icons in a colour per level (Urgent a red "!" square, High orange, Medium blue, Low grey), and TODO's Add tasks lists urgent work first. Priority never reorders a column. Bots, `opp tasks add --priority` and the MCP `create_task` can set it.
- 250c8d6: Plan's To do is what you mean to work on, not only what is due: a task has a To do day (`focusDate`) apart from its due date, set in the task dialog, by the dashed row or with Add tasks. To do lists what is put on the day and what is due on it, keeps unfinished work from earlier days until it is done, and keeps a task ticked done on the day it was done.
- 0079b26: To do's rows reorder by dragging the six-dot grip at their right end; the
  order is kept per day on this device.

  - `@oppenheimer/design-system-web`: `SortableTodoRow`; `TodoRow` draws its
    `children` last on the row.
  - `@oppenheimer/translations`: `tasks.todo.reorder`.
  - `@oppenheimer/web-showcase`: the To do demo reorders.

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

- 5c8b948: Projects: pick several project cards and delete them at once. `ProjectCard`
  takes an optional checkbox (`select`, `selected`, `selecting`).
  The kit gains `useMultiSelection` (the Inbox's, moved) and
  `BulkConfirmDialog`, which the Tasks board's delete now uses too.
- 0f2f802: Plan's Projects follows the 2026-11-08 `Tasks` artboards: projects are
  cards, and a card opens the project's own page.

  - `@oppenheimer/design-system-web`: `ProjectCard`, `ProjectCardGrid` and
    `ProjectCardSkeleton`; `ProjectOverview`, `ProjectOverviewColumn`,
    `ProjectPanel`, `ProjectPanelEmpty`, `ProjectMilestoneRow`,
    `ProjectTaskRow` and `ProjectOverviewSkeleton`.
  - `@oppenheimer/web`: `/plan/projects` draws a card per project (its
    repositories, and Needs input, Running or Idle from its sessions);
    `/plan/projects/$projectId` is the project's page, with a way back to the
    cards, its settings, its milestones, the tasks that wait on a person and
    the ones in progress.
  - `@oppenheimer/translations`: `projects.list.status` and `projects.detail`;
    `projects.list.edit` and `projects.list.repositories` are gone.

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

- 0a0c8a4: TODO: each open row, and the task dialog beside its TODO day, has a Remove button that takes the task off TODO, off every day and whatever its due date, until it gets a TODO day again or its due date changes. Tasks carry `offTodo`, which `PATCH /v1/tasks/{id}` takes.
- 1dbae54: A failed session start can be tried again. The start pane's **Try again**
  sends the host the same start, for the same session and with the same task
  (`POST /v1/sessions/{id}/retry`, `SESSIONS_052` for a session whose start did
  not fail), and draws the new attempt in place. A host whose Claude Code is not
  signed in to claude.ai refuses a cloud start with `SESS_019`, which the pane
  explains; the CLI's own words reach the console without its terminal escapes
  and with their spaces.
- 6917f62: Review sessions: a pull request's Chat tab starts Claude Code on one of your hosts, in a worktree of its head branch, on a review prompt that opens with a two-or-three-line take, then shows its terminal with an input line under it. Review sessions are listed under For review in the Pull requests sidebar and left out of Sessions (`origin = 'review'`, `pull_request_review_session`). New routes: `POST /pulls/…/review-session` and `GET /pulls/review-sessions`; a fork's pull request is `PULLS_002`. The pull request detail says whether its head is in a fork (`fromFork`).
- 6168d0e: A bot's routine can run on a custom schedule: a five-field cron expression the bot writes from your words, for what once, hourly, daily, weekdays, weekly and monthly cannot say (several times a day, every 15 minutes during work hours, the last weekday of the month with `LW`, the second Tuesday with `2#2`, the last Friday with `5L`). It keeps the zone and the daylight-saving rules every schedule has, fires at most every five minutes, and the Routines tab and the approval card say it in words, never as the raw fields. A session automation does not take one; its editor has no field for it.
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

- ecf6d14: A session's chat copies what was said, as Claude Code on the web does: the
  prompt from under its card, on hover, beside its time, and a settled turn's
  answer (its last words, every reply after its last piece of work) from a
  trail beneath it.

  - `@oppenheimer/frontend-web`: `CopyTextButton` moves here from the bots
    feature, so the session chat and a bot's chat share it.
  - `@oppenheimer/translations`: `sessions.chat` gains `copyMessage` and
    `copyReply`.

- b3b6805: The session chat has a find bar. Ctrl+F (⌘F on a Mac) opens it over the
  conversation. It searches the prompts and replies of every turn the chat
  holds, including turns it has not drawn yet and words a settled turn has
  folded away. It opens on the newest match. Enter goes to the one before and
  Shift+Enter to the one after. The chat draws and opens the turn a match is
  in and scrolls to it, and marks the matches in the text. The kit gains
  `markdownText`, the words `Markdown` draws for a source, so the count agrees
  with what is on screen. `useStickToBottom` gains `leave()`, which stops the
  chat following its end when the chat itself moves the reader up.
- dd942da: The console's browser notifications also tell a session whose turn ended (its row's dot went blue) and, once, a session left amber or blue for thirty minutes. Mute notifications in a session's row menu, kept on the device like Mark as unread, silences one session.
- 45d642b: A session runs in a new worktree or in a folder already on the host
  (`product/design/sessions/session-places.md`).

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
  (`product/design/sessions/session-share-links.md`): one share per session
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

- 6125030: The sessions sidebar picks several sessions at once: ⌘/Ctrl-click toggles a row, Shift-click spans from the last one, and Select in a row's menu does the same on a touch screen. While rows are picked the Projects line becomes a selection bar that pins, moves to a project or deletes them together; Escape or the bar's close clears it. `SessionItem` takes `selected`, which swaps its glyph for a check box.
- 97f9547: The sessions sidebar's filter menu finds what needs you: a Status facet
  (All statuses, Needs input, Ready for review) narrows the list to the rows
  whose dot is amber or blue, with a chip like the other facets, and Sort by
  gains Needs input first (needs input, then ready for review, then the rest,
  each newest first).

  - `@oppenheimer/translations`: `sessions.filters` gains `status`,
    `allStatuses` and `statuses`; `sessions.sort` gains `attention`.

- b5a9490: Settings → About shows the version of the console and of the API it talks to. The API answers its version at `GET /health/version`.
- dd40ea3: A sidebar group's header has a menu, at its ellipsis or on a right-click:
  hide every session the group lists (or show them again once all are hidden),
  or delete them all after the dialog for several asks.

  - `@oppenheimer/web`: `GroupSessionsMenu` on each project group, the group of
    sessions with no listed project, and Pinned.
  - `@oppenheimer/design-system-web`: `SidebarProjectHeader` takes `menuOpen`,
    which keeps its actions shown while a menu among them is open.
  - `@oppenheimer/frontend-web`: `SidebarPinnedGroup` takes `actions`,
    `onContextMenu` and `menuOpen` for its head.
  - `@oppenheimer/translations`: `sessions.group.*`, and the `sessionsHidden`
    and `sessionsShown` toasts.
  - `@oppenheimer/frontend-consumer`: `settleEach`, the one policy for a bulk
    write over sessions (four requests in flight at a time, a refusal does not
    stop the rest, the first reason as an `Error`), which the selection bar,
    Delete all and the new `useSetSessionsHidden` share; the batch hide re-reads
    the list once at the end.

- 1fcf738: The sessions sidebar can show only its pinned sessions. The filter menu has
  a Pinned only check, kept on this device like a hidden project and left on
  by Clear filters; while it is on, the list draws Pinned and no project, the
  count is the pinned sessions, the filter button stays lit, and with nothing
  pinned the list says how to pin one.
- d2df32e: Pick the session's device in the Simulator tab, and refresh it.

  - `@oppenheimer/shared`: `device.info` gains `devices` (each `serial`,
    `name`, `platform`, `free`; `DEVICE_CHOICES_MAX`), and the link gains
    `device.select`; the attach socket's `device` carries `devices` and takes
    `device.select` from the browser.
  - `@oppenheimer/runner`: a device attach looks at the host's devices afresh
    and lists them; `device.select` moves the session onto a free one,
    switches the screen on the same attachment and rewrites the agent's
    session note. A device another session holds is refused.
  - `@oppenheimer/api`: the relay passes `devices` through and forwards
    `device.select`, dropped from a read-only share.
  - `@oppenheimer/frontend-consumer`: `DeviceStream.select` and `refresh`;
    `DeviceChoice`.
  - `@oppenheimer/web`: the Simulator's device line is a picker when the host
    offers more than one, with Refresh beside it.
  - `@oppenheimer/translations`: `sessions.preview.device`, `deviceSearch`,
    `deviceEmpty`, `deviceTaken`, `refreshDevice` and `platform.*`.

- a58c432: The Simulator says it is waiting instead of showing a black phone.

  - `@oppenheimer/web`: until the device sends its first picture, the phone's
    screen shows a spinner and "Waiting for the screen…", and takes no taps
    or keys.
  - `@oppenheimer/translations`: `sessions.preview.noPicture`.
  - `@oppenheimer/design-system-web`: `--device-screen-fg` and
    `--device-screen-fg-muted`, words on the device's black screen in both
    themes.

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

- a69aa94: TODO knows about agents (`product/design/plan/plan-calendar.md` §6,
  "Changed on 2026-11-12").

  - `@oppenheimer/web`: a task on TODO that an agent is working on (a session
    running or queued, none waiting on the person) moves to a "With agents"
    section under the list, with its session's chip; the others with sessions
    stay on the list marked waiting on you, failed, ready to review (the In
    review column only) or agent stopped. The header's "left" and the
    sidebar's TODO count leave out what is with agents. Each open row has a
    Move button (Tomorrow, or a day picked on a month) that sets its TODO
    day, except a task its deadline holds on the day shown.
  - `@oppenheimer/design-system-web`: `DatePicker` takes the caller's own
    trigger as `children` (an `IconButton` on a row); the month and the quick
    picks are the same.
  - `@oppenheimer/translations`: the board's first column reads "Not started"
    ("Sin empezar"), the dialog's day field "TODO day" ("Día en TODO"), and
    "on TODO since {{date}}"; `tasks.todo` gains `withAgents`, `mark.*`,
    `move`, `moveTitle` and `moveFailed`.
  - `@oppenheimer/web-showcase`: the board's first column is Not started, and
    the DatePicker spec shows an icon trigger.
  - `@oppenheimer/shared`: the bots' bundled guide follows the user guide's
    TODO page.

- cc244a1: A session whose finished turn has sat unread for thirty minutes is now an Inbox item that asks you to move it forward, in place of the browser notification that reminded about it. Reply here on its card opens the session, streamed as on its page, to answer it without leaving the Inbox. A check in the sessions sidebar's filter menu, Remind me after 30 minutes unread, on by default and kept on the device, turns it off. A session's response now names its unread turn (`unreadReport`), which keys the item. A session muted from its row's menu is never listed as unattended.
- 828d404: Add tasks filters its list by Project and Status. Each facet takes several
  picks and counts what it would show under the other; Project starts at the
  projects To do is narrowed to, and Add puts on the day only the checked
  tasks the filters still show.
- 2d187ed: Update a host's runner from the console: **Update runner** in a host card's
  menu on Settings → Hosts (`product/design/runner/runner-install-and-update.md` §5, "Manual control").

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

- 8da03fc: A visual can carry an `html` block, for what the typed blocks cannot draw: the agent's fragment runs in a sandboxed frame on `visuals.<preview domain>`, a static page the preview server serves with the network closed and only the console allowed to frame it. The console posts the fragment and its theme in and takes back only the page's height, its errors and links to open, which ask first. Without a preview domain, or with the `visual_html` flag off, the block shows its source, folded, and the bots' tool refuses it.
- 8fef0a2: Visuals in the chat: an agent can show a titled card of typed blocks (figures, bar, line and area charts, a ring of shares, a ranking, a sortable table, a checklist, progress against targets, a record, a callout and links), drawn with the console's own charts in light and dark. Charts switch to their numbers as a table, figures count up, bars and rings grow in, and the whole card opens larger or copies its data. A spec that is not a visual shows a folded note with what is wrong instead of breaking the chat.
- a56308b: Voice is configured with the keys. Settings → Model providers lists Groq and
  ElevenLabs (voice only) beside the bot providers, and a Voice section picks,
  for the workspace, the speech-to-text provider and model, the voice-note
  provider, model and voice (OpenAI's set, or any ElevenLabs voice id), and the
  transcript polish's provider and model, or none. `GET`/`PUT /v1/voice/settings`
  hold the choices in `voice_settings`; dictation, WhatsApp voice notes heard and
  spoken, and the polish try the chosen provider first and the rest after it.
  Speech synthesis becomes a provider list like transcription, with the
  deployment's `VOICE_TTS_*` server last.
- 06b40ca: A linked WhatsApp number keeps the chats its owner allows besides their own,
  each with the bot that answers there. Stored and shown only: an allowed chat
  wakes no bot yet.

  - `@oppenheimer/api`: `GET`, `POST /v1/whatsapp/accounts/{id}/grants`,
    `PATCH` and `DELETE …/grants/{grantId}` (`WHATSAPP_015` to `WHATSAPP_018`).
    A bot's `allow_whatsapp_chat` and `revoke_whatsapp_chat`, offered only in
    the owner's console chat and their own WhatsApp chat, and
    `list_whatsapp_allowed_chats`. A bot that answers in an allowed chat is not
    deleted (`BOTS_043`). A tool can be kept to the owner’s own turns (`ownerOnlyOn`).
  - `@oppenheimer/api-client`: `findWhatsappChatGrants`, `allowWhatsappChat`,
    `updateWhatsappChatGrant` and `revokeWhatsappChat`.
  - `@oppenheimer/web`: Settings → WhatsApp → Allowed chats, under a number
    whose owner is confirmed: each group or person, who allowed it, the bot
    that answers there, and Remove.
  - `@oppenheimer/frontend-consumer`: `WhatsappChatGrantEntity`, and
    `WhatsappRepository.findGrants`, `answerChatAs` and `revokeGrant` with
    their hooks.
  - `@oppenheimer/translations`: `settings.whatsapp.allowed.*` and
    `errors.byCode.WHATSAPP_015` to `WHATSAPP_018`, in English and Spanish.
  - `@oppenheimer/shared`: `whatsappChatGrantSchema`,
    `allowWhatsappChatSchema`, `updateWhatsappChatGrantSchema`,
    `WHATSAPP_CHAT_KINDS` and `WHATSAPP_CHAT_GRANTS_MAX`.

- 3da961d: A WhatsApp number's Settings lists its groups and saved contacts before anyone writes: the runner reports them on connect and when a group is joined or renamed or the contacts change (the new `whatsapp.chats` frame), and the API keeps them per number (`whatsapp_known_chat`, up to 5,000, forgetting a chat not reported for 7 days). A group set to a bot now wakes it on every message with words, not only a mention or a reply, up to 120 turns an hour per group. People lists the owner first, fixed on the default bot; the "Answered by" filter is searchable and caps its height; the tab counts sit on their label's baseline, and `FacetSelect` takes `size="sm"` so a filter row stands at one height.
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
  (`product/design/channels/answering-on-telegram-and-whatsapp.md`, slice 3).

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

- edcc92d: Bots send WhatsApp voice notes: `send_whatsapp_voice_note` speaks a short text on the deployment's text-to-speech server (`VOICE_TTS_*`, optional) and the runner sends it as a playable push-to-talk note over the new `whatsapp.send.voice` frame (capability `whatsapp.voice.send`). It asks like a text, with the exact words and the chat on the card, and spends the same send budget.
- 27f034a: The wordmark stands alone: the console's brand row and the auth and public
  pages show "Oppenheimer" without the "Console" suffix. `Wordmark` loses its
  `product` prop, `BrandLogo` is gone (the auth and public chrome draw
  `Wordmark` directly), `AuthLayout` loses its `product` prop, and the
  `common.product` key is gone from the catalogs.

### Patch Changes

- 1819aa6: Bots no longer get a **Heartbeat** routine by default (`bot-routines.md`
  §6, "Changed 2026-11-15"). The migration `PauseDefaultBotHeartbeats` moves
  every heartbeat still on its hourly trigger to twice a day, 09:00 and 18:00
  in the zone its owner last wrote from, and pauses every running one, so it
  stops spending a model turn an hour; the owner turns it back on and changes
  its times like any routine. A scheduled beat with nothing new in the bot's
  chat since the last one is skipped as `idle` without a model turn. Run now
  always runs.
- e315b92: A bot tells the person a line in the Inbox (`product/design/sessions/agent-tools.md` §5). Its new `notify` tool keeps the bot's latest line in `bot_notice` (one row per bot, a new id with each notice), raises `botNotice.changed` on the workspace stream, and `GET /v1/bot-notices` reads each bot's notice on the bots the caller may read, newest first, at most 50. The Inbox lists it as a `botNotice` item keyed `botnotice:<bot>:<notice>`, with Open chat and Done, counted under the Type facet's "Bots" (was "Bot approvals").
- 8612fd8: A bot's live line thinks in a word picked for the turn ("Pondering…",
  "Percolating…", "Tinkering…") instead of always "Thinking", the same word for
  the whole turn.

  - `@oppenheimer/translations`: `bots.chat.turn.musing.*` in English and
    Spanish, in place of `bots.chat.turn.thinking`.

- 18e4a35: A bot turn no longer dies with "unsupported Unicode escape sequence" when a
  tool brings in text Postgres cannot store, such as an invoice PDF whose text
  layer holds NUL bytes (#728). The chat's messages drop NULs and replace lone
  surrogate halves before they are written (`storableText` and `storableJson` in
  `@oppenheimer/backend-core`), and `read_mail_attachment` cleans what it
  extracts. A call whose result is still refused fails that call alone, and the
  turn goes on; any other refused write ends the turn with the new failure kind
  `storage`, whose card says the fault is ours, not the model provider's.
- 7f18bbe: A bot turn that Claude Code ended because its context filled up (autocompact
  thrashing, the window's hard limit, a prompt still too long after compacting)
  no longer reads as "Anthropic refused this request … change the message or
  the model". It fails as the new kind `context`, and the chat says the context
  filled up, that the provider refused nothing, and to have the bot read less
  at once or split the request.
- 39dbe36: Bots, the Needs input card (`product/design/bots/bots.md` §5).

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

- 502a40c: Bots, slice 2 (`product/design/bots/bots.md` §2): a bot answers.

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

- ac929fa: Bots on a ChatGPT subscription (`product/design/bots/bots.md` §2): a fourth
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

- 59809f9: Bots read images (`product/design/bots/bots.md` §3.1, issue #426).

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

- 060dabb: Bots in the console's sections (`product/design/bots/bots-in-sections.md`).

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

- 6af341b: Bots, slice 1 (`product/design/bots/bots.md`): a bot without a runtime.

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

- 33cb1d8: Cloud sessions: a session can run in Cursor's cloud on the person's own
  Cursor key, chosen in New session's place picker
  (`product/design/sessions/cloud-agents.md`).

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

- f6a81a2: Codex cloud sessions start on Codex's current cloud: in Codex's default
  environment with the repository, or in an environment id pasted from ChatGPT
  Settings → Codex Cloud. The environment picker no longer asks the host for a
  list of legacy environments (`GET /v1/hosts/:id/codex-environments` and its
  codes `SESSIONS_044`–`047` and `055` are gone); it offers Default and the id
  you paste. A host whose codex is not signed in to ChatGPT refuses the start
  with `SESS_022`.
- 7a8851a: A Codex cloud start whose environment the CLI cannot find is its own refusal,
  `SESS_010`, instead of the CLI's bare "not found". codex-cli resolves `--env`
  only against the environments `codex cloud` lists; the ones made in ChatGPT
  Settings → Codex Cloud are not reachable by it yet. The detail names the labels
  tried and the environment labels on the account's recent tasks (a partial list:
  the CLI lists environments only in its TUI), and the failed start's pane
  explains it in English and Spanish with a link to Codex Cloud settings.
- ee06c2c: Credentials that outlive a session now need a verified email, and a password
  reset takes back API tokens, OAuth grants and browser sessions.

  - `@oppenheimer/api`: minting an API token, approving or exchanging an OAuth
    (MCP) grant, minting a host pairing token and issuing a routine's webhook
    URL are refused with `TOKEN_010` until the account's email is verified, on a
    deployment that delivers email (`email_delivery`: SMTP or Resend; without it
    no address can be verified, so the rule does not apply), and
    the token endpoint refuses a `code` or `refresh_token` that is not a string.
    A password reset ("Forgot password") takes back, in its own transaction, the
    API tokens and OAuth grants issued before it: it sets the account's
    credential cutoff (a migration adds `credential_cutoff` and
    `api_token."issuedAt"`), from which every API token or OAuth grant whose
    chain began earlier, including a token minted by one, is refused; it deletes
    the account's OAuth grants, consents and unexchanged authorization codes; and
    the tokens are then marked revoked. Browser sessions are signed out as
    before. Paired hosts and routine webhook URLs record whether the owner's
    email was verified when they were issued (a migration adds
    `"issuedVerified"` to `host_pairing_token`, `host` and
    `automation_webhook`, backfilled from the owner's address as it is now);
    a reset unpairs the hosts, revokes the unspent pairing tokens and revokes
    the webhook URLs issued unverified, which only a deployment without email
    delivery issues, and keeps the rest. `POST
/v1/admin/users/{id}/set-password` now takes back what a reset does, and
    signs the account's sessions out; when it cannot, it answers `ADMIN_008`
    and is retried. A reset does not take back an OAuth exchange already past
    the grant gate at the instant of the reset (a window of milliseconds). If that transaction fails, the reset answers an error
    rather than success (the new password is already stored; resetting again
    from a new link completes it). Better Auth's
    rate limit keys on the client address `TRUST_PROXY` trusts (the socket's at
    `0`), never on `X-Forwarded-For` as sent. Social-login provider tokens are
    stored encrypted. A migration renames `oauthApplication."redirectURLs"` to
    the `redirectUrls` Better Auth writes, which had broken MCP client
    registration.
  - `@oppenheimer/cli`: `opp login` on an unverified account says to verify the
    email first instead of pointing at a missing permission.
  - `@oppenheimer/translations`: the message for `TOKEN_010`, and the copy of
    the console's Resend verification email action.
  - `@oppenheimer/frontend-core`: `useSendVerificationEmail` and
    `IAuthClient.sendVerificationEmail`, a new verification link to the
    signed-in account's own address.
  - `@oppenheimer/frontend-web`: `ErrorAlert` draws `TOKEN_010` with a Resend
    verification email action that says where the link went, or that it could
    not be sent (Add host, onboarding's host step, a routine's webhook URL, the
    MCP consent screen).
  - `@oppenheimer/web`, `@oppenheimer/mobile`: their auth clients send the link
    through Better Auth's `send-verification-email`.

- 47e4398: Empty states follow one pattern in three tiers. `EmptyState.Art` draws one
  of eight illustrations from a single family (inbox, projects, pull requests,
  done, automations, milestones, tasks, not found), and it stands over a
  screen's main region the first time it is empty or once it is through:
  Projects, the pull-request queue and the end of the review deck, both
  Automations tabs, Milestones, an empty day in TODO, the Inbox and the
  not-found page. Any other state of a pane, and every Settings section, takes
  the 44px icon disc (Hosts, a pull request with no changes, filters that match
  nothing, a project or automation that is gone, a bot with no routines);
  sidebars, rows and pickers keep their one muted line. `InboxClear` is now an
  illustrated `EmptyState`; `RoutineTableEmpty` and `MilestoneEmpty` are gone,
  and so is the console's `HostsEmpty`.
- fc246b3: The engine picker follows the version-1 design: one button for agent, model and effort, a popup with a tab per agent and one of starred Favourites, a search across every agent's models, and the effort slider at its foot. Favourites are kept on the device. `AgentModelSelect` takes `favourites`, `onFavouritesChange`, `effort` and `labels`; `engineKey` names a favourite. New session's choices row (`ComposerChoices`) stays on one line: the place chips truncate and the engine keeps its width.
- 96a8a1b: The extension's popup reads at a glance. A session that needs you is a
  two-line Inbox row that says what it asks ("Wants to use Bash", "Failed ·
  tests are red") and its repository, instead of a name whose reason only
  showed on hover. The header says when sessions were last checked, the "You're
  clear" state no longer fills half the popup, a running session's name
  breathes like it does in the console, and the Oppenheimer connection folds
  behind "Connect to Oppenheimer" until you open it, with a state dot on its line
  once connected.
- 9402a5a: Publish the extension on the Chrome Web Store (unlisted): merging a version bump builds, zips, uploads and submits it for review, and Chrome updates installs once Google approves it. The privacy policy gains a section on the extension, at `/privacy#extension`.
- 33cb1d8: Grok as a bot model provider (`product/design/bots/bots.md` §2).

  - `@oppenheimer/shared`: `xai` in `BOT_PROVIDERS`, after OpenAI and before GLM
    in `BOT_PROVIDER_PREFERENCE`, with Grok 4.7 (effort low to extra high) and
    Grok Build 0.1 (no effort) in its catalog row.
  - `@oppenheimer/backend-agents`: `XaiBotEngine`, the OpenAI engine pointed at
    xAI's Responses API (`api.x.ai/v1`).
  - `@oppenheimer/api`: `xai` in the provider checks of `bot`, `bot_turn` and
    `model_provider_credential`; its key is stored like OpenAI's.
  - `@oppenheimer/web`: Grok's row in Settings → Model providers, drawn with
    Grok Build's mark in the model button.

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
- 48da240: The Inbox's API (`product/design/console/inbox.md` §4). `GET /v1/bot-approvals?status=pending` reads the workspace's approvals across its bots, newest first, at most 100, each with `botId`, `botName` and `sessionId`, under `bots:read` and `IDX_bot_approval_org_status`. Every move of an approval (raised, decided, expired, run) now raises `BotApprovalChangedDomainEvent`, which the workspace stream sends as `botApproval.changed`.

  A new `inbox` module keeps a person's marks on Inbox items in `inbox_mark` (`done`, `low`, `snoozed` until a time, `deleted`; one per person, workspace and occurrence): `GET /v1/inbox/marks` (a snooze that has ended is left out), `PUT /v1/inbox/marks/:itemKey` and an idempotent `DELETE /v1/inbox/marks/:itemKey`, under the new `inbox:read` / `inbox:write` scopes, which, like `profile`, no role backs, and the `inbox` release flag. Each write sends `inboxMark.changed` to that person's streams only. Errors `INBOX_001`–`INBOX_004`.

  `@oppenheimer/shared` adds `INBOX_MARKS`, `putInboxMarkSchema`, `inboxItemKeySchema`, `findWorkspaceBotApprovalsSchema` and the two events; the console refetches `['bots', 'approvals', 'pending']` and `['inbox', 'marks']` on them.

- 02894e4: The Inbox's other cards say more: a bot approval shows the call it wants to run (its input, a line per field), a failed session says why it did not start (the reason its page gives, and the host's own words under it), a failed run shows its exit code and, when there is nothing to open or run again, why, and a pull request ready to merge names its author. Why a session did not start is the kit's `useStartFailure`, shared by the session's page and the Inbox.
- dd3acdd: The Inbox's clear reading pane is warmer: `InboxClear` centres its heading
  and line under a small drawing of an empty tray (inline SVG in the theme's
  tokens, decorative and hidden from assistive technology), and the heading
  reads "You're all caught up" ("Estás al día"). The line under it, with the
  sessions still running, is unchanged.
- ce6374e: An Inbox pull request card says Open, for the pull request in the console, and offers View on GitHub, which opens it on github.com in a new tab.
- 7c0a70c: Inbox reports, the API (`product/design/console/inbox.md`, "Reports"). The `inbox` module stores its one item, a report, in `inbox_report`: `POST /v1/inbox/reports` takes a title, a body, a source and a link as `multipart/form-data` with up to 4 PNG, JPEG, GIF or WebP pictures of up to 5 MB each under `images`, judged by their bytes and kept in storage; `GET /v1/inbox/reports?status=open|answered` lists the workspace's, newest first, at most 100; `GET /v1/inbox/reports/:id` is what the sender polls for the answer; `GET /v1/inbox/reports/:id/images/:imageId/content` reads a picture. These are under the new `inbox-reports:read` / `inbox-reports:write` scopes, which, like `inbox`, no role backs. `POST /v1/inbox/reports/:id/answer` is under `inbox:write`, so a token holding only the report scopes cannot answer what it asked; a report is answered once. Each send and answer reaches the workspace's streams as `inboxReport.changed`. Errors `INBOX_005`–`INBOX_009`.
- c33abbe: The Inbox's bulk actions are found at a glance: Select in the list's head
  shows every row's checkbox, X checks the item on the deck, and Escape or
  the cross leaves selecting. `inbox.selection.start`.
- 35f32be: Answer a session's question or permission from its Inbox card (the console
  half of the Inbox's slice 4, `inbox.md`).

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

- 008609b: Several keys per model provider, and the next one taken when a key runs out of
  credit (`product/design/bots/bots.md`, "A provider can hold several keys, and a
  spent one hands over").

  - `@oppenheimer/api`: `model_provider_credential` holds up to
    `MODEL_PROVIDER_KEYS_MAX` rows per provider, in `position` order, each with a
    `spentAt` mark. `POST /v1/model-providers/:provider/keys` adds one (`BOTS_049`
    past the cap), `PUT …/keys/:keyId` replaces one and
    `DELETE …/keys/:keyId` removes one (`BOTS_050`). A bot turn the provider
    refuses for credit before it wrote anything marks the key and runs again on
    the next; a turn that completes on a marked key clears the mark.
  - `@oppenheimer/shared`: `MODEL_PROVIDER_KEYS_MAX`.
  - `@oppenheimer/frontend-consumer` and `@oppenheimer/web`: Settings → Model
    providers adds another key, and draws each of several keys on its own row
    with Remove and Replace, a spent one marked out of credit.

- 9b0c57f: OpenCode sessions get the chat view. The runner launches OpenCode serving its
  own API on a loopback port with a password of the session's, follows the
  conversation through it while a browser is attached, and sends each finished
  part as a line of the transcript the chat already reads, OpenCode's tools under
  the names the chat knows. The chat names the session's agent on its composer and
  empty state, and shows no context meter for a model whose window it cannot know.
- 1496a5f: Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
- 52d7e8c: Search Projects by name or repository (`?q=`), and pick a task's or a milestone's project from a select with a search instead of a row of pills.
- a80436f: A project may hold no repository. It is a place for tasks, milestones,
  memory and sessions before it is a set of repositories, and folder and
  terminal sessions need none.

  - `@oppenheimer/shared`: `projectRepositoriesSchema` accepts an empty list;
    a default is required only when the project holds a repository.
  - `@oppenheimer/api`: the project aggregate and `PROJECTS_006` no longer
    refuse an empty list. The code still names a list with no default, a
    repository twice, more than twenty, or a blank base branch.
  - `@oppenheimer/web`: the project dialog saves a named project with no
    repository, and removing the last repository sends an empty list.
  - `@oppenheimer/translations`: `errors.byCode.PROJECTS_006` reads the rule
    as it now is.

- 50cbfa3: A bot's notice in the Inbox can be answered on its card: Reply here opens the bot's chat under the notice, its recent conversation over the composer, so you read what led to the line and reply without leaving the Inbox. `InboxDeck` takes no swipe that starts in a `data-swipe-ignore` region.
- 4f9afb3: Projects: a project can no longer be named or renamed "Unassigned" (`PROJECTS_009`); it listed as a second Unassigned group in the sidebar.
- ce53664: Every Spanish counted string has its `_many` form, so a count of a million shows text instead of a raw key, and the seed registers the team entities it was missing.
- 71d4e51: A bot's routine no longer wakes for a pull request its own session opened.
  A session opens its pull request and pushes with `gh` as the owner, so the
  check for our own App's events let them through, and a routine such as
  "review every new pull request" woke its bot to review its own work. If that
  turn started another session, it looped until the hourly cap.

  A session a bot starts now records that bot (`work_session.botId`). When a
  GitHub event names a branch (pull request opened, pushed, merged, a check, a
  review, a push), a routine whose bot started a session on that branch, a host
  session's checkout or a cloud session's run, records the run as skipped,
  `own_session_event`. A fork's pull request never counts as a bot's own. Other bots' routines and session
  automations still fire, and a bot following its own pull request with
  `watch_pull_request` still wakes.

- d687bfd: A session read as a chat takes files on its messages. The paperclip, a paste on the chat and a drop on the pane hold them as chips over the field, under New session's rule (an image, a PDF or text, 5 MB, five at a time), and a refused one is said under it. Sending puts each file on the host, whose path the runner pastes into the agent's prompt, then the words and Enter, so the agent takes them as one message; a file that does not arrive keeps it and the words in the composer and says why. `ChatComposer`'s inline layout takes `onAttach` and `attachments`, and `ComposerFile` is the file chip `Composer` and the session chat share. `SessionChat.send` takes `withFiles`, which lets a message be files alone and waits for their paths to land before the words.
- 45604ff: A session's chat keeps its tool calls folded to their summary line, also while the agent is still in the run, with the call in flight under it. A long conversation stays quick: the chat store rebuilds only the open turn on each line (a closed turn keeps its identity, unless a result lands on one of its calls), and the view draws the latest 40 turns with "Show earlier turns" above them, opened without moving the reader. Claude Code's questions answer better: the agent's tag over each question, focus on the first option so the number keys answer at once, a lone one-choice question answered by the pick as the terminal picker does, Enter to move on from an answer in the person's own words, and answers that could not be typed stay to be sent again (`SessionChat.answer` returns whether they went). `QuestionPanel` takes `header` and `autoFocus`.
- d687bfd: A session read as a chat answers the questions Claude Code asks (`AskUserQuestion`). The questions take the composer's place, one at a time, each option picked by its row or its number, several where the agent allows them, or answered in the person's own words; Submit types the keys Claude Code's picker takes, and Dismiss is Escape. The transcript keeps what was asked and answered, or that it was dismissed, and a watcher sees that the agent is waiting. `SessionChat.answer` sends the answers, `ChatToolCall` carries `questions` and `answers`, and `QuestionPanel` takes a set of picks where several are allowed.
- aa92290: A session's chat queues what is written while the agent works and shows the room left. A message sent mid-turn waits on the composer (`SessionChat.post`), to be sent now, edited or dropped, and goes on its own when the turn ends, one at a time. Beside the model, the context meter opens to the context in tokens (with Compact) and the plan's 5-hour and weekly limits with their resets.

  The limits are Claude Code's own: the runner launches a session's Claude Code with `--settings` naming `runner statusline` as its status line, which keeps what the CLI hands it (`context_window`, `rate_limits`) by conversation and still draws the person's own status line, or `ctx · 5h · 7d` when they have none; the chat follower sends the latest as an `oppenheimer.status` entry (`ChatState.status`). The runner also keeps each answer's token counts (`message.usage`), so the context is counted off the transcript until the status line says. `ComposerContextMeter` forwards a button's props, so it can be a popover's trigger, and the composer's field is no longer remounted when something appears on top of it.

- ea93480: A Claude Code session read as a chat, a proof of concept behind
  `session_chat_view` (`product/design/sessions/terminal-and-chat.md`).

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

- 758963a: A session row's menu keeps Mark as unread and Mute notifications under a Notifications & read pane, so its first level is shorter.
- ac71ace: A session can run a second coding agent in a window of its own worktree,
  beside the agent in window 0, not only a plain shell.

  - `@oppenheimer/shared`: `session.window.open` takes an optional `agent`, any
    catalog coding-agent id but `shell` (`windowAgentSchema`), with the optional
    `model`, `effort` and `permission` picked for it (the launch's bounds) and a
    first `prompt` (`session.create`'s bound, now the named `promptText`), and
    runners name the new capability `session.window.agent`.
    `schemas/session-window` adds `openSessionWindowBodySchema` (the launch
    schema plus `agent`) and `SessionWindowAgent`.
  - `@oppenheimer/runner`: names `session.window.agent` in its hello. An open with
    `agent` makes the window named by the agent's catalog id and launches the
    agent in it as window 0's is at create (folder trusted, executable held),
    with the model, effort and permission the open picked; each one not picked
    is the session's (its permission level always, its model and effort only for
    the session's own agent), and the first task as its trailing positional. A
    failed `tmux respawn-pane` names the window and no longer the command line,
    which carries the person's task. A launch that fails kills the window. `shell` and
    ids outside the catalog are refused.
  - `@oppenheimer/api`: `POST /v1/sessions/:id/windows` takes an optional body
    `{ agent?, model?, effort?, permission?, prompt? }`; no body is still a plain
    shell, and the launch fields and the prompt go to the host only with `agent`. A host whose runner lacks
    `session.window.agent` is refused with `SESSIONS_060`.
  - `@oppenheimer/api-client`: regenerated (`OpenSessionWindowRequest`).
  - `@oppenheimer/frontend-consumer`: **breaking for callers**:
    `useOpenSessionWindow().mutate` takes
    `{ sessionId, agent?, model?, effort?, permission?, prompt? }` instead of the session
    id; `openWindow(id, input?: OpenSessionWindowInput)` on the sessions
    service. The launch fields and the prompt are sent only with an agent that is
    not `shell`.
  - `@oppenheimer/translations`: `SESSIONS_060` in English and Spanish.

- db80935: A failed start's details from the host read as the host's terminal showed them: escape sequences gone, one line per line, in a monospace block.
- 4189871: Start session on a task offers any repository the workspace's GitHub
  installations reach, not only the project's.

  - `@oppenheimer/web`: the repository chip lists the project's repositories
    first (on the base branch the project set), then every other one the
    installations reach (on its default branch), with "Manage repository access"
    at its foot. The form's `repositoryId` becomes `repository`, a
    `repositoryKey`.
  - `@oppenheimer/translations`: `tasks.start.noRepositories` no longer sends
    the reader to the project's settings.

- 1062c57: Telegram's owner link works without the Telegram app: under a link just made, a "No Telegram app?" fold walks through opening the bot's chat on Telegram Web and sending the `/start <code>` message, with Copy, which drops the link's code.
- 4ee069d: A linked WhatsApp number answers its owner
  (`product/design/channels/answering-on-telegram-and-whatsapp.md`, slice 3).

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

- 4ee069d: Lay the ground for a bot answering its owner on WhatsApp
  (`product/design/channels/answering-on-telegram-and-whatsapp.md`, slice 3),
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

- 99219f9: The console mounts the automations overview, runs, run view, editor and sidebar against the consumer's `automations` module.
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

- f099524: Add an `errors` namespace with a message per error code in both locales.
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- c078d0d: `GET /health/capabilities` reports `hosts`, and the console's pairing surfaces mint no token when it is false.
- fc0e75d: The hosts backend for the Settings page (`product/design/runner/hosts-settings.md`).

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
    until the code switches over (`product/design/runner/host-metadata.md`).
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

- 1a51afc: Split the catalogs into namespaced translation files.
- 2202daa: A session's first task can carry images.

  - `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
  - `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
  - `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
  - `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
  - `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images to the first task.

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

- d5d310c: An organization's repositories can be reached from the project dialog, and a requested organization install is said rather than dropped.
- 2dc27d2: Plan: a task board, goals and a calendar, the console rail's third item
  (`product/design/plan/plan.md`).

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

- 0918701: Settings → Profile's strings, and the USER_002, USER_003 and PROFILE_009 messages.
- 173bb4c: Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag) and a default host and agent; the slug comes from the name and never changes. Nothing is derived from a repository any more: `originGithubRepoId` is gone, and a session that names no project is listed in the workspace's **Unassigned** project, which every workspace has and which cannot be renamed or archived (`PROJECTS_008`). `POST /sessions/{id}/move` lists a session under any active project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New project is a page (`/projects/new`) that returns to New session on the project it made; the project chip starts on Unassigned, and each sidebar row gains a Move to project menu. The translations gain a `projects` namespace. `PROJECTS_004` and `SESSIONS_009` are no longer raised.
- cefbc53: Pull requests: a queue of the watched repositories' open pull requests read live from GitHub (Mine, Review requests, Watching), each in a rule-based lane with what holds it; a briefing with the path to merge, the description, the diff with line comments, and a review that approves and merges in the user's own name; watched repositories; and analytics of the review period against the one before.
- f099524: Add the `validation.*` messages the shared error map resolves (`required`, `email`, `minLength`, `maxLength`, `minItems`, `maxItems`) plus `apiTokens.permissionsRequired`, in both locales.
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

- a566fac: A session's start says when the host is downloading the repository for the
  first time: the clone step carries `download`, and the start pane explains
  the longer wait.
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/design/sessions/session-share-links.md`).
- f101364: English and Spanish messages for the `SESSIONS_*` catalog and for the three
  `PROJECTS_*` codes archiving adds.
- 43a17c1: - **frontend-web**: `notifySuccess`, the success toast, which takes a `toasts.*` key.
  - **web**: toasts the writes whose result is easy to miss, and deleting an automation asks through one confirm dialog on the table and on its page.
  - **translations**: success copy under `toasts.*`.
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

- ab97201: The `control`, `pages` and `home` namespaces and 48 keys nothing reads are removed.
- 1a51afc: Add `/locales` and `/lazy` entrypoints so only the default locale reaches the critical path, and declare `sideEffects`.

### Patch Changes

- 2063d42: A rate-limited request answers `RATE_001` with a `retryAfter` member instead of a codeless 429. `POST /v1/access-grants` returns the grant it created, instead of falling back to another grant in the organization.
- 1ed003e: The automations pages, the editor, the sidebars and Settings match the
  2026-09-27 frames.

  - `@oppenheimer/design-system-web`: `EditorPage` sits on the recessed canvas;
    `FieldSelect` gains a quiet variant with `FieldSelectGroup` / `FieldSelectRow`;
    `StatusDot` gains a compact density; `SidebarListHead` and
    `SidebarProjectGroup` join the sidebar; `BrandGlyph` takes the theme's ink by
    default.
  - `@oppenheimer/web`: an automation opens on Back and the ordinary page header,
    run history is drawn before the first run, and New session sits on the grey
    canvas with a line saying what sending will do.
  - `@oppenheimer/translations`: copy for the repository count and New session's
    line.

- f099524: Add the strings the login page renders when a deployment has no social provider configured.
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

- 79e30e5: Add `errors.byCode` messages for the ten `GITHUB_*` codes in both locales.
- 8e2de68: Add the `HOSTS_*` error messages in `en` and `es`.
- 8d78094: Translate the `PROJECTS_*` problem codes in every locale.
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
- 6b943c3: Removing a host stops its sessions on the machine, as the remove dialog says.
- 38b511f: Restart brings a session back where it left off, and the stopped pane says so.

  A restart recreated window 0 and started the agent from nothing, replaying the
  first task — so the conversation was lost and the work asked for twice. Now
  that a session names the agent's own conversation, a restart reopens it
  instead: same worktree, same branch, the whole exchange back, and no prompt
  re-sent because the conversation already holds it. Grok joins Claude Code;
  Codex and OpenCode can only resume an id they chose themselves, so they keep
  restarting the way they did.

  The pane that said "This session has stopped. Its work is on its branch" now
  names the branch, says restarting brings the terminal back where it left off,
  and leads with **Restart**. A deleted session has no worktree to return to, so
  it is offered nothing.

- 1a51afc: Add an `errors.byCode` message for `ROLE_007` (`SYSTEM_ROLE_MISSING`) in both locales.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- cb56034: Add `sessions.new.{host,repository,branch}.loading` in both locales — what a
  scope chip's popup says while its list is still being read, in place of
  "No host matches."
- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
- c237a5f: The console's sidebar reorders by dragging: a project by its header among
  the others (`SortableSidebarProjectGroup`), and a session within its project
  or into another one, which moves it there. The order is kept on the device,
  and the sort menu gains Custom order, its new default.
  `useSortableGroups` tells `onChange` when a drag settles and hands `onMove`
  the value it settled on; a session write stays pending until the session
  lists have refetched.
- 0e25c03: A session whose agent has not drawn yet says so, instead of showing a white
  rectangle.

  The host reports a session started once tmux holds it, which is before the
  agent inside has painted anything — a few seconds cold, and thirty-five of them
  on a machine under load. The provisioning pane has handed over by then, so the
  reader got an empty pane with a live status dot and no way to tell a slow start
  from a broken session.

  The terminal now covers the grid with "Waiting for the agent" until the first
  byte that would put a glyph on it. Not the first byte: an attachment opens with
  tmux's own preamble — a device-attributes query, the cursor put home, a clear —
  which is bytes that paint nothing, so the cover has to read the escape grammar
  rather than count bytes. A reconnect replays the scrollback, so a session that
  has run before never shows it.

- 818f20c: `GITHUB_015` and `CALENDAR_010` are 429s with `Retry-After`, declared on every route that reaches GitHub or Google. `@oppenheimer/backend-core` gains `UpstreamLimiter` and `AppError.retryAfterSeconds`; `@oppenheimer/backend-cache` gains `CacheService.setMax`.
- e647495: The terminal's waiting cover names both reasons the grid is empty.

  It was written for a cold agent, but it also shows while an older session's
  scrollback replays — which on a busy host took several seconds, and telling
  someone their agent is starting when it started an hour ago is just a
  different lie. The reader's question in both cases is whether it is broken, so
  the copy answers that and names both.

- 8d66c87: Pull requests: watched repositories are chips with a remove button under Watching, and Watch a repository is a search over the ones not watched yet, instead of a popover listing every repository with a checkbox.
- a0e23bd: Search params are Zod schemas (`searchText`, `searchFlag`, `searchPage`) and nuqs is removed; the `one-api-client` rule and the removed `sessions.agents` keys ride along.

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

  - copy for the token-creation and OAuth consent screens.

  Deploying runs a migration that adds the `api_token` and OAuth tables and grants
  every user permission over their own tokens. `pnpm generate:api-client` no
  longer needs a running database.

### Patch Changes

- 68348a6: Surface session-restore failures instead of silently logging the user out.

  Previously a transient network/server error during startup session restore was
  indistinguishable from being genuinely unauthenticated: `getSession()` swallowed
  the error as `null`, `useSessionRestore` ran with `retry: false` and no error
  handling, and both the web and mobile `AuthGate`s only branched on `isLoading` —
  so a single network blip bounced a logged-in user to `/login`.

  - **web/mobile auth clients**: `getSession()` now throws on transport/server
    errors instead of returning `null`, letting the query distinguish a failed
    lookup from an unauthenticated session.
  - **web/mobile `AuthGate`**: render a "connection problem" screen with a retry
    action on restore failure instead of falling through to `/login`.
  - **`@oppenheimer/translations`**: new `auth.session` strings (en + es).
