# @oppenheimer/design-system-web

## 1.0.0

### Major Changes

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

### Minor Changes

- 566f850: Automation editor: each trigger card has Duplicate beside Remove, which puts a copy right under it. A new automation no longer guesses a project or picks repositories; picking a project picks none, and a GitHub trigger added before any is picked listens on all of them once they are.
- 7b5c7b3: Tasks board: pick several cards (⌘/Ctrl-click, Shift-click for a run) and delete them together from the bar that floats at the foot of the page, after one confirmation. `TaskCard` takes `selected`, and `TaskSelectionBar` is the new toolbar.
- c9aa79c: Tasks board: drag from the board's empty space to draw a rectangle that picks every card it touches. ⌘, Ctrl or Shift held at the press adds to what is picked; a click on empty space clears it. Picked cards move together: drag one and the rest follow under it, or use Move to in the selection bar to send them all to a column's foot. `TaskMarquee` is the new rectangle.
- 50be89a: A bot's chat marks the `/command` a message starts with (`/ship fix the build`), in the link blue on the selected wash: in the composer while it is written and in the sent message. `ChatCommand` is the new mark, and `ChatComposer` takes `command`, the prefix of its value to mark, drawn by a copy of the text under the textarea.
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

- 50429c4: A bot's effort saves once per adjustment, when its picker closes, instead of once per stop the knob crosses, which a drag across the track turned into a burst of updates the API refused as too many requests. `EffortPicker` takes an optional `onOpenChange` so the caller can tell when it closes.
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

- 089b66c: A bot's model picker draws each provider's logo: GLM takes Z.ai's mark and ChatGPT OpenAI's, where both fell back to the bot glyph. `AgentMark` takes `glm` and `chatgpt`.
- 08bb08b: A bot is a one-line row in every sidebar that lists one (Employees and the
  Bots heading under Sessions, Plan and Pull requests), as the 2026-11-06
  design export draws it: 32px tall, a 20px square avatar and the name, with
  the last message in the row's tooltip and the needs-input and unread dots
  kept. `BotItem` drops `age`, and `BotAvatar` takes a `className`.
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

- b39d40f: Claude Code's model list matches Claude's own picker: Opus 5.5, Fable 5.1, Sonnet 5.5 and Haiku 5.5, then Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8, Opus 4.7, Opus 4.6 and Sonnet 4.6 behind a "More models" row in the engine button.
- 73ce336: Port the 2026-10-13 evening export: `BotExchange` and `ProposedFile` in the chat's cards, `ComposerApproval` fused onto the composer through its new `above` slot, `BotItem`'s `needsInput`, `SidebarProjectHeader`'s eyebrow tone and `marker`, `SidebarEmptyCard`, `TemplateTiles` and a centred `ChatEmptyState`.
- 663e8ed: The 2026-10-13 export's new components. Settings controls: `Switch`,
  `PillGroup` (one value or a set) and `NumberStepper`. Share: `PeoplePicker`
  with `PersonChip`, and `AccessList`. Plan: `MilestoneTimeline` and
  `MilestoneGlyph`, `FacetSelect`, `DateRangePicker`, `AreaChart` and
  `CalendarAccountList`. Employees: `BotItem` (and `SortableBotItem`),
  `AvatarPicker`, `RoutineCard`, `SettingsListRow`, `SettingsAddRow` and
  `SettingsTopBar`. The agent chat, one file per family of the Chat Components
  inventory: transcript, work and tools, cards, dividers and status, the
  composer stack, decisions, composer extras and the header. Adds the
  `--selected-fg` token and the `shimmer` and `caret` animations.
- c1161c5: Enter sends while you dictate. In New session, a session's chat and a bot's
  chat, Enter (in the field, on the recorder, or with nothing focused once the
  recorder has replaced the field) ends the recording and sends as soon as what
  was said lands in the draft, so the spoken rest is never dropped; a failed
  transcription sends nothing and leaves the draft; Enter on the recorder's
  own buttons stays theirs, so Cancel cancels. `DictationSlot` takes `finish`,
  a promise that settles once the text has landed (`useDictation().finish`),
  and the composers' shared send takes a generic `beforeSend` that holds a
  send until it settles.
- fc246b3: The engine picker follows the version-1 design: one button for agent, model and effort, a popup with a tab per agent and one of starred Favourites, a search across every agent's models, and the effort slider at its foot. Favourites are kept on the device. `AgentModelSelect` takes `favourites`, `onFavouritesChange`, `effort` and `labels`; `engineKey` names a favourite. New session's choices row (`ComposerChoices`) stays on one line: the place chips truncate and the engine keeps its width.
- 231fb59: A form's fields stand at one height. `DatePicker` (28px, though its notes
  said 34px) and `FieldSelect`'s field look (42px) take a `size` on the control
  ramp and default to `md`, 34px, the same rung as `Input`, on the same field
  border and fill. `Chip` takes `size="md"` for a chip that is a form's field,
  and `TimeField`'s trigger moves to `md` beside the `DatePicker`.
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

- d264253: A hidden session's row shows an eye-off icon instead of the word "Hidden".
  The icon keeps "Hidden" as its accessible label.

  - `@oppenheimer/design-system-web`: `SessionItem`'s `status` takes a node,
    so a row can carry a labelled icon in the age's place.
  - `@oppenheimer/web`: a hidden row's status is the `EyeOff` icon.

- 1484bc6: The Inbox takes bulk actions. Check rows (on hover, shift-click for a run, or Select in a row's menu), then mark them all done, deprioritize, snooze or delete them from the bar that replaces the list's head. Escape clears the selection. The API marks a whole selection in one request, `POST /v1/inbox/marks/batch`, checking every key before it writes any.
- dd3acdd: The Inbox's clear reading pane is warmer: `InboxClear` centres its heading
  and line under a small drawing of an empty tray (inline SVG in the theme's
  tokens, decorative and hidden from assistive technology), and the heading
  reads "You're all caught up" ("Estás al día"). The line under it, with the
  sessions still running, is unchanged.
- cca8cfb: The Inbox in the console (`product/versions/mvp/29-inbox.md`): a first rail item with a bell and the count of what needs you, where the console now lands (a stored rail order that lacks it gets it at the front). `/inbox` lists sessions waiting on you, bots' pending approvals, pull requests requested of you or ready to merge, and the last day's failed runs, most blocked first, filtered by type and project, with Show done and a Snoozed list; each row's menu marks it done, deprioritizes it, snoozes it or deletes it. The pane brings one item at a time as a card with its answers (Approve / Deny, Merge and Review, Run again and Open run, Open session), Later, and a log of what was done this visit. Behind the `inbox` flag.

  `@oppenheimer/frontend-consumer` adds the `inbox` module (marks, and the composition of the four reads into ordered, keyed items), `useSuspenseInbox`, `useInboxCount`, `usePutInboxMark` and `useDeleteInboxMark`, and declares itself free of side effects so the console's bundle carries only the hooks it uses. `@oppenheimer/design-system-web` adds the Inbox's parts (`InboxItem`, `InboxCard`, `InboxLogLine`, `InboxSnoozedRow`, …).

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

- 1496a5f: Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
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

- 723089c: Plan's sidebar views (Inbox, Tasks, Milestones, Calendar) can be dragged into the reader's own order, kept on this device, as the rail's items can; a click still opens the view, and Space picks one up from the keyboard. `SortableRoutineItem` is a `RoutineItem` that drags.
- 88f61b5: Plan's Project filter takes several projects. `SearchableFacetMultiSelect`
  is `SearchableFacetSelect` over a set: its rows are checks, the popup stays
  open while they are toggled, the first row (All projects) clears the set,
  and the trigger reads the first pick then `+N`. The board, its counts,
  Milestone's options and the Milestones timeline narrow to every project
  picked, carried in the address as `?project=web,billing`, so a link to one
  project reads as it always did. A card keeps its project's name while
  several are picked, and a task added from the board files under the first
  of them. The Inbox's Type menu now sets each count apart from its label.
- 9871b11: Plan's board drops the Later column and gains In review, between In
  progress and Done: `TASK_STATUSES` is `todo`, `doing`, `review`, `done`.
  A migration moves every task in Later to the end of To do, in its order,
  and bumps its version. Attaching a session still moves a task in To do to
  In progress. The CLI's and MCP server's status choices, the bots' plan
  tools and `tasks.columns` follow.
- 0079b26: To do's rows reorder by dragging the six-dot grip at their right end; the
  order is kept per day on this device.

  - `@oppenheimer/design-system-web`: `SortableTodoRow`; `TodoRow` draws its
    `children` last on the row.
  - `@oppenheimer/translations`: `tasks.todo.reorder`.
  - `@oppenheimer/web-showcase`: the To do demo reorders.

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

- fa85016: Pull requests load in their own shape. The queue, analytics, a pull request's Description, Changes and Chat views, the rail's comments and Watched repositories each draw a placeholder in the real containers, with their static labels written and a bar at the height of each line still to come, so the page does not jump when the data lands; the queue header no longer shows zeros before the queue answers. `PullRequestRowSkeleton` is a queue row's placeholder on the row's own grid, and `Skeleton` is now hidden from assistive technology and pulses only when motion is allowed.
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

- d687bfd: A session read as a chat takes files on its messages. The paperclip, a paste on the chat and a drop on the pane hold them as chips over the field, under New session's rule (an image, a PDF or text, 5 MB, five at a time), and a refused one is said under it. Sending puts each file on the host, whose path the runner pastes into the agent's prompt, then the words and Enter, so the agent takes them as one message; a file that does not arrive keeps it and the words in the composer and says why. `ChatComposer`'s inline layout takes `onAttach` and `attachments`, and `ComposerFile` is the file chip `Composer` and the session chat share. `SessionChat.send` takes `withFiles`, which lets a message be files alone and waits for their paths to land before the words.
- 45604ff: A session's chat keeps its tool calls folded to their summary line, also while the agent is still in the run, with the call in flight under it. A long conversation stays quick: the chat store rebuilds only the open turn on each line (a closed turn keeps its identity, unless a result lands on one of its calls), and the view draws the latest 40 turns with "Show earlier turns" above them, opened without moving the reader. Claude Code's questions answer better: the agent's tag over each question, focus on the first option so the number keys answer at once, a lone one-choice question answered by the pick as the terminal picker does, Enter to move on from an answer in the person's own words, and answers that could not be typed stay to be sent again (`SessionChat.answer` returns whether they went). `QuestionPanel` takes `header` and `autoFocus`.
- d687bfd: A session read as a chat answers the questions Claude Code asks (`AskUserQuestion`). The questions take the composer's place, one at a time, each option picked by its row or its number, several where the agent allows them, or answered in the person's own words; Submit types the keys Claude Code's picker takes, and Dismiss is Escape. The transcript keeps what was asked and answered, or that it was dismissed, and a watcher sees that the agent is waiting. `SessionChat.answer` sends the answers, `ChatToolCall` carries `questions` and `answers`, and `QuestionPanel` takes a set of picks where several are allowed.
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
- 6125030: The sessions sidebar picks several sessions at once: ⌘/Ctrl-click toggles a row, Shift-click spans from the last one, and Select in a row's menu does the same on a touch screen. While rows are picked the Projects line becomes a selection bar that pins, moves to a project or deletes them together; Escape or the bar's close clears it. `SessionItem` takes `selected`, which swaps its glyph for a check box.
- f384b6a: Every loading placeholder that was a grey slab now has the shape of what loads: the hosts list, Devices, Model providers, a bot's home host, instructions and revision history, memory and chat history, the task and Start session dialogs, Milestones, the event dialog and Google accounts. Plan's headers keep their counts line while the tasks load. `HostCardSkeleton` is a host card's placeholder on the card's own frame. The slab debt list is empty.
- 8283986: To do's rows are picked up by the pointer anywhere on the card, not only by
  the six-dot grip; the done toggle never lifts the row, and a press on the
  title that moves under 5px is still a click that opens the task. The grip stays the keyboard's handle and,
  on a touch screen, the part that drags instead of scrolling.

  - `@oppenheimer/design-system-web`: `useSortableItem` returns its
    `listeners`, so a surface can put the pointer's on a box bigger than the
    handle; `SortableTodoRow` puts it on the row.
  - `@oppenheimer/web-showcase`: the TodoRow entry says so.

- a69aa94: TODO knows about agents (`product/versions/mvp/20-plan-calendar.md` §6,
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

- 27f034a: The wordmark stands alone: the console's brand row and the auth and public
  pages show "Oppenheimer" without the "Console" suffix. `Wordmark` loses its
  `product` prop, `BrandLogo` is gone (the auth and public chrome draw
  `Wordmark` directly), `AuthLayout` loses its `product` prop, and the
  `common.product` key is gone from the catalogs.

### Patch Changes

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

- 419f41c: Session chat: a file a turn changed opens from its row in a viewer, as the diff of what the turn wrote to it, without leaving the chat. It shows what the transcript carried, so an edit the host cut says so. A written file's line count no longer counts the newline it ends on as a line. `DiffView` waits for the diff highlighter before it mounts, so a diff that is on screen from its first render is drawn in development too.
- 9ddd8a1: `useStickToBottom` lets go of the end only when the reader scrolls up: a
  wheel turned up, a touch, an up key, or a press on the scrollbar. When content
  shrinks for a frame, the browser clamps the view up itself and reports that a
  frame later, by which time the content may have grown back. The hook read
  that as the reader leaving the end, so a long session chat could stop one
  screen short of its end while its history loaded, with "Jump to latest"
  showing. A move up the reader did not make now scrolls back to the end.
- db2a91a: `useStickToBottom` turns off scroll anchoring on its scroller while it follows
  the end, and turns it back on once the reader scrolls away. A chat that keeps
  a window of its latest messages drops the oldest from the top as new ones
  arrive. The browser's anchoring moved the view up by the height that left,
  the hook read that move as the reader leaving the end, and it stopped
  following. In a bot chat whose conversation fills the API's window, a burst
  of new messages could leave it stuck partway up with the chevron showing.
  While the reader is up in the conversation, anchoring still keeps their place.
- 3223f4b: `ToolCallLive`, the line under a session's chat that says what the agent is
  running now, stays on one line: a long command cuts its target with an
  ellipsis, as a finished call's row does, instead of widening the chat so its
  pane scrolled sideways.
- a956535: A session's chat: Enter on the empty field sends the first queued message now, so Enter twice sends a message into the turn under way. In every composer, Enter while dictating ends the recording and leaves what was said in the field to read; the next Enter sends it.
- e8fd98c: A drop into a folded group lands again. The drag layer keeps the carried item's data from when it was picked up, so once a row carried into a group that draws no rows (a folded project in the console's sidebar) unmounts, its `type` still matches the group's `accepts`. Before, dnd-kit handed back empty data, no target took the item, and the drop went nowhere: a session dragged into a folded project was never moved.
- 170ce4c: A section's Bots heading folds: its label is a toggle, with a chevron shown
  on hover and while folded, and the fold is kept per section on this device.
  `SidebarFoldLabel` is the toggle, passed as a `SidebarListHead` label, and the sidebar's
  stored-list helpers (`storedList`, `useStoredList`, `withFold`) move to
  the platform kit, now that bots and sessions both keep lists on the device.
- 3b5d381: Pi (`pi`) and Oh My Pi (`omp`) are agents a session can run. Both take a
  model as `provider/id` and a thinking level, reopen their conversation with
  `--continue`, and the runner installs them as the person: pi from npm, omp
  with Bun. Pi has no approvals, so its sessions show no permission chip; omp's
  three levels are its `--approval-mode` (`always-ask`, `write`, `yolo`). Both
  are terminal only for now, with no chat view.

  Settings → Agents chooses which agents New session's engine picker offers on
  this device, also reached from a gear at the end of the picker's strip. A
  fresh device offers Claude Code, Codex, OpenCode, Grok and the blank
  terminal; Pi and Oh My Pi are there to switch on. An agent switched off
  stays in the picker while a draft is on it.

- 19d77e6: The project dialog writes repository names in the rows' own 13px type, as the New session repository chip does, where it used mono: the Add a repository pane, the added rows under it, and Cloned by default. Branch names stay mono.
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

## 0.2.0

### Minor Changes

- 1a51afc: Rebrand onto the Alpaca Labs visual language: monochrome-first, flat tokens with `globals.css` as the single source of truth, sixteen new components, five chat primitives, and every overlay brought onto the brand's metrics.
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

- cb56034: Give `ChipSelect`'s parts and `DropdownMenuRadioItem` a density, so the
  composer's two menus are a shape the components own rather than measurements
  restated at each call site: `ChipSelectPopup`, `ChipSelectItem`,
  `ChipSelectSearch` and `ChipSelectBack` take `density="menu"` for the engine
  pane, and `DropdownMenuRadioItem` takes `density="compact"` for the permission
  menu. New `ChipSelectList` is one pane body — rows, the loading line, or the
  empty one — and caps itself in rows of its density; `ChipSelectEmpty` takes
  `live` for a list still being read, and `ChipSelectItem` takes `trailing` for a
  row that ends in something other than a check. `ChipSelect` and
  `RepositorySelect` take `loading`, and `RepositorySelect` a separate
  `branchesLoading` for its branch pane.
- 9431938: The design system draws a session's host going offline and coming back
  (a banner in the status bar's place by default, a card over the scrollback
  as the other form), the command to copy that brings it back, an offline
  host's detail on Settings, and a pane that takes dropped files.
- 08d42f1: A generic drag layer, and Plan in the design system: the task board and
  goals, the month calendar, the date picker and the session pane's header.
  `PageHeaderRow` takes a `display` size.
- 121d28a: Pull requests in the design system: the queue, a pull request's briefing
  and review decision, the diff with its comments and file tree (on
  @pierre/diffs and @pierre/trees), file-type marks, the review analytics'
  charts, and a rail the reader can reorder. `SegmentedControl` takes `md`
  and `lg` sizes and item counts; `StatusDot` gains the gate states
  `passing`, `blocked` and `waiting`; `Badge` gains `strong` and `soft`;
  `Stepper` lays out horizontally; `RadioGroup` is new; the dark chart teal and violet moved to
  pass colour-blind separation.
- c983201: The sidebar's sessions reorder by dragging, inside a project or into another
  one (`SortableSessionItem`). A sortable row that is also a link picks up on
  Space so Enter still opens it, and the screen reader is told so
  (`useSortableControl`).
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- c05c4ff: - The shell frames a page at the route's measure: `staticData.pane` is a size
  of `EditorPageBody`, or `full`. `measure` is gone.
  - `EditorPageBody` takes `size` instead of `wide`; `TaskBoard`'s `gutter` prop
    is gone.
- d5d310c: An organization's repositories can be reached from the project dialog, and a requested organization install is said rather than dropped.
- 473557a: - `EditorPageBody`'s `size` is a measure the export repeats: `status`,
  `composer`, `narrow`, `wide`, `board`, `fluid`. A child opts in to the
  frame's edge with `data-bleed`.
  - The shell frames the page; `EditorPage` paints no ground.
  - `staticData.pane` may be a function of the route's search.
  - The kit adds `PaneBar` and `usePaneDrop`; the design system exports
    `DropOutline`.
- 0918701: `SettingsForm`, and `SettingsRow`'s `control="field"` width.
- c237a5f: The console's sidebar reorders by dragging: a project by its header among
  the others (`SortableSidebarProjectGroup`), and a session within its project
  or into another one, which moves it there. The order is kept on the device,
  and the sort menu gains Custom order, its new default.
  `useSortableGroups` tells `onChange` when a drag settles and hands `onMove`
  the value it settled on; a session write stays pending until the session
  lists have refetched.

### Patch Changes

- eff0947: A bar chart's x axis draws at most sixteen labels, evenly spaced, always
  including the first bar of each month. Ninety bars of eight pixels each drew
  ninety labels into a single grey smear.
- 080641e: `BarChart`'s bars are pills, round at both ends, as the export draws them
  (`border-radius: 980px`), instead of a 4px rounding on top only.
- 287d688: Composer: give the prompt box back the height the design gives it.

  `field-sizing-content` sizes a textarea to its content and overrides the `rows`
  attribute outright, so the empty composer collapsed to a single line while every
  class still looked correct. The export's floor is 112px, which is the prompt box
  having presence before anyone has typed into it — the whole point of the
  control. It is a `min-h` now, with `rows` kept as the no-`field-sizing`
  fallback.

  Measured against `.op-composer__input` in the same pass: the textarea's vertical
  padding is 16px both sides rather than 16/8, the attach and mic buttons are the
  export's 30px tool rather than the 28px `sm` control, and their glyphs and the
  send arrow are 15px at stroke 2.2.

  The type is a new `text-compose` step (16px/1.5). The export declares 16px
  nowhere but this one rule — it sits between body (15px) and body-lg (17px) —
  which is the same case `text-operate` already documents, so it is a named token
  with a comment rather than an arbitrary value or a rounding to the nearest step.

- c5437b1: The console's rail can be put in the reader's own order by dragging.

  - `@oppenheimer/web`: the rail's items are sortable; a press still opens the
    list, a drag past 5px or Space picks one up, and the order is kept on this
    device. The items are one table, `RAIL` in `features/sessions/lib/rail-order.ts`.
  - `@oppenheimer/design-system-web`: `RailItem` joins a caller's
    `aria-describedby` with its count's, so a `SortableRailItem`'s count is
    still read out beside the drag instructions; a lifted rail item is a
    round pill on the card surface, not the card-shaped box.

- 94a700e: - `@oppenheimer/web`: the console's Settings and project glyphs follow the spec in 05.
  - `@oppenheimer/design-system-web`: a `ChipSelect` action takes a `trailing` mark, and `EffortPicker`'s hint describes its slider.
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

- 6b943c3: Removing a host stops its sessions on the machine, as the remove dialog says.
- b32d3b8: - `@oppenheimer/frontend-core`: `useQuery` and `useQueries` that share entities across refetches.
  - `@oppenheimer/frontend-consumer`: every query hook goes through them.
  - `@oppenheimer/frontend-web`: `createDialogSlot` replaces `ConsoleDialogProvider`, `useConsoleDialog` and `useConsoleList`; `SidebarSearchField` is added.
  - `@oppenheimer/design-system-web`: `useNow` shares one timer per interval; `FieldSelect` no longer reads a ref in render.
  - `@oppenheimer/web`: fewer re-renders in the sidebars and the project dialog.
- 3e6e3dc: Settings → Hosts, as `design/version1/Settings.dc.html` draws it: a page in its own frame, reached from the account menu, listing the workspace's hosts as cards (status, running sessions, OS · vCPU · runner version, connected or last seen) with inline rename, copy ID and remove, and Add a host opening inside the same frame. `HostCard`, `SettingsNav`, `PageHeader`, `RoutineSteps` and the tabbed `CodeBlock` panel now measure as the version-1 export does.
- 4ffcdd6: Plan's columns line up with the header and the goals above them. The board's
  scroller reaches into the page's gutter on its own (`TaskBoard`'s `gutter`),
  the way the artboard draws it, instead of the whole board hanging 32px to the
  left of the page.
- 1a51afc: Declare `sideEffects` (CSS excepted).
