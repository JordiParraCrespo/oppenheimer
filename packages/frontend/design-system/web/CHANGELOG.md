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
- 7cd821a: A section's Bots heading folds with motion: the list closes on its height and fades (`SidebarFoldPanel`), and the bots' faces rise into the heading one after another. Reduced motion keeps the jump.
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

- fcb29f7: A bot's sidebar row reads as a session's. Waiting on you (an approval or questions pending, or a failed turn since you last read the chat) is the amber dot; working (a turn queued or running) shimmers the name; a message you have not read, or the row's own Mark as unread, is the blue dot. `GET /v1/bot-activity` lists the bots working and waiting on you; `POST /v1/bots/:id/acknowledge` reads a bot's chat (`bot."acknowledgedAt"`, added by a migration and backfilled to each bot's last message), and each bot carries `unread`. A turn queued or ended raises `BotTurnChangedDomainEvent`, sent on the workspace stream as `botTurn.changed { id, botId }`. `BotItem` takes `working` for the shimmer apart from `live`, its green dot.
- 4d13159: Calendar: every entry on Day, Week and Month wears a colour, a wash of it with a bar down its left edge and its glyph in it: personal events blue, tasks violet, each Google account its own, automation runs in subtle ink. Free events wash lighter behind a dashed edge, all-day events deepest. The sidebar's layer glyphs take the same colours as a legend, and the first Google accounts now start on teal and green so they never share a colour with events or tasks. `CalendarLayerItem` takes `accent`; `CALENDAR_KIND_ACCENT` names the kinds' colours.
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

- c7f6935: Controls stand on the 28 / 34 / 42px ramp. `SegmentedControl`'s track is 28, 34 or 42px (was about 27, 32 and 40), `PillTabs` md is 34px (was 32), `PillGroup`, `FacetSelect`'s `pill`, `FieldSelect`'s `quiet`, `ChipSelectTrigger`'s `tab`, `ComposerToolButton` and `SettingsAddRow`'s field are 28px (were 30 or 32). A bot's Permissions search now stands level with its Decision and Group selects, and Automations' New automation with its tabs.
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
- caa731f: A folded Bots heading keeps its bots' faces beside the label: each opens its chat and carries the state its row would (amber when it needs you, blue when unread, breathing while it works), and a `+N` chip unfolds the list when they do not all fit. The design system adds `BotFaces` and `BotFaceItem`, and `SidebarListHead` takes a `summary`.
- 1144fea: The folder chip's path field walks its folders from the keyboard: ↑ and ↓ light the recent, listed and found folders, Enter opens the lit one as a click does, and with none lit Enter still uses the folder typed. Opening a folder clears the light, so Enter then uses it. `ChipSelectSearch` takes an `icon` in place of the magnifier and a `trailing` note, which the path field uses for its folder glyph and the host's home.

  `ChipSelectCombobox` no longer takes `loading` or remounts when its rows land, which moved the caret and dropped IME text mid-typing; Enter with nothing lit takes the first row in a pane that opens on a choice. The e2e specs that looked up the migrated search fields as `textbox` look them up as `combobox`.

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

- 4bc2e95: Mark a session unread from its row's menu to come back to it later: the row
  keeps a blue dot, on this device, until the session is opened.
- a176e15: Another bot's answer in a bot's chat ("Oppie replied") now arrives folded to its lead line, with a chevron to open it, instead of spreading its whole text across the transcript. The design system's new `BotExchangeFoldTurn` (a `BotExchangeTurn` that folds, with `defaultOpen`) draws it; a message from another bot still shows in full.
- 1496a5f: Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
- 749cf21: When Claude Code or Codex stops to ask permission for a tool, the session chat answers it in the composer's place: the command (coloured, under the agent's own description), or the file and a short diff of the edit, then Allow once, Always allow (in the agent's own words for what it would stop asking about) and Deny, with 1–3, Enter and Esc as in the terminal and Deny with a note. A command that deletes a tree or rewrites shared history tints the card amber. The dialog is read off the terminal with each agent's spec beside the question keys (`permissionPromptOf`, `permissionChoiceKeys` in `@oppenheimer/shared/sessions`); an agent with none keeps the status line. `ApprovalPanel` takes `tone`, `picked`, `disabled`, `autoFocus`, `foot` and `onDismiss`.
- 2530f25: Every picker with a search is picked from the keyboard the same way. `ChipSelectCombobox` (Base UI Combobox, inline in the popup) wraps a pane's search, list and rows: ↑ and ↓ move the highlight while the focus stays in the search, Enter takes the highlighted row, and the field names it to a screen reader through `aria-activedescendant`. `ChipSelect`, `RepositorySelect` (both panes), `FieldSelect`, `RepositoryAddField`, `RepositoryRowList`, `SearchList` and the engine button use it, and so do the console's host chip, bots menu, Link existing and watched-repository search, which drop their own highlight state and key handlers. `ChipSelectItem` loses its `highlighted` prop: the combobox owns the highlight.
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
- bf71f50: Plan's tasks have a priority: Urgent, High, Medium or Low, or none (the default). The task dialog has a Priority row, a card shows it with Linear's icons in a colour per level (Urgent a red "!" square, High orange, Medium blue, Low grey), and TODO's Add tasks lists urgent work first. Priority never reorders a column. Bots, `opp tasks add --priority` and the MCP `create_task` can set it.
- 0079b26: To do's rows reorder by dragging the six-dot grip at their right end; the
  order is kept per day on this device.

  - `@oppenheimer/design-system-web`: `SortableTodoRow`; `TodoRow` draws its
    `children` last on the row.
  - `@oppenheimer/translations`: `tasks.todo.reorder`.
  - `@oppenheimer/web-showcase`: the To do demo reorders.

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

- 473a7f5: A right-click on a bot's sidebar row, in Employees or under a section's Bots heading, and on a review session's row under For review, opens the row's own menu at its ellipsis instead of the browser's, as a session's row already did. Every such row takes its menu's state and its right-click from one hook, `useRowMenu` in the design system.
- d687bfd: A session read as a chat takes files on its messages. The paperclip, a paste on the chat and a drop on the pane hold them as chips over the field, under New session's rule (an image, a PDF or text, 5 MB, five at a time), and a refused one is said under it. Sending puts each file on the host, whose path the runner pastes into the agent's prompt, then the words and Enter, so the agent takes them as one message; a file that does not arrive keeps it and the words in the composer and says why. `ChatComposer`'s inline layout takes `onAttach` and `attachments`, and `ComposerFile` is the file chip `Composer` and the session chat share. `SessionChat.send` takes `withFiles`, which lets a message be files alone and waits for their paths to land before the words.
- b3b6805: The session chat has a find bar. Ctrl+F (⌘F on a Mac) opens it over the
  conversation. It searches the prompts and replies of every turn the chat
  holds, including turns it has not drawn yet and words a settled turn has
  folded away. It opens on the newest match. Enter goes to the one before and
  Shift+Enter to the one after. The chat draws and opens the turn a match is
  in and scrolls to it, and marks the matches in the text. The kit gains
  `markdownText`, the words `Markdown` draws for a source, so the count agrees
  with what is on screen. `useStickToBottom` gains `leave()`, which stops the
  chat following its end when the chat itself moves the reader up.
- 45604ff: A session's chat keeps its tool calls folded to their summary line, also while the agent is still in the run, with the call in flight under it. A long conversation stays quick: the chat store rebuilds only the open turn on each line (a closed turn keeps its identity, unless a result lands on one of its calls), and the view draws the latest 40 turns with "Show earlier turns" above them, opened without moving the reader. Claude Code's questions answer better: the agent's tag over each question, focus on the first option so the number keys answer at once, a lone one-choice question answered by the pick as the terminal picker does, Enter to move on from an answer in the person's own words, and answers that could not be typed stay to be sent again (`SessionChat.answer` returns whether they went). `QuestionPanel` takes `header` and `autoFocus`.
- d687bfd: A session read as a chat answers the questions Claude Code asks (`AskUserQuestion`). The questions take the composer's place, one at a time, each option picked by its row or its number, several where the agent allows them, or answered in the person's own words; Submit types the keys Claude Code's picker takes, and Dismiss is Escape. The transcript keeps what was asked and answered, or that it was dismissed, and a watcher sees that the agent is waiting. `SessionChat.answer` sends the answers, `ChatToolCall` carries `questions` and `answers`, and `QuestionPanel` takes a set of picks where several are allowed.
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
- b77c9e0: The tabs over Sessions drag into the reader's own order, kept on this device with the open tabs, so a reload draws them where they were dropped; a click still opens a tab. The design system adds `SortableChatTab`, which makes the `ChatTab` inside it a sortable item on the drag layer.
- 6125030: The sessions sidebar picks several sessions at once: ⌘/Ctrl-click toggles a row, Shift-click spans from the last one, and Select in a row's menu does the same on a touch screen. While rows are picked the Projects line becomes a selection bar that pins, moves to a project or deletes them together; Escape or the bar's close clears it. `SessionItem` takes `selected`, which swaps its glyph for a check box.
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

- a58c432: The Simulator says it is waiting instead of showing a black phone.

  - `@oppenheimer/web`: until the device sends its first picture, the phone's
    screen shows a spinner and "Waiting for the screen…", and takes no taps
    or keys.
  - `@oppenheimer/translations`: `sessions.preview.noPicture`.
  - `@oppenheimer/design-system-web`: `--device-screen-fg` and
    `--device-screen-fg-muted`, words on the device's black screen in both
    themes.

- f384b6a: Every loading placeholder that was a grey slab now has the shape of what loads: the hosts list, Devices, Model providers, a bot's home host, instructions and revision history, memory and chat history, the task and Start session dialogs, Milestones, the event dialog and Google accounts. Plan's headers keep their counts line while the tasks load. `HostCardSkeleton` is a host card's placeholder on the card's own frame. The slab debt list is empty.
- 8283986: To do's rows are picked up by the pointer anywhere on the card, not only by
  the six-dot grip; the done toggle never lifts the row, and a press on the
  title that moves under 5px is still a click that opens the task. The grip stays the keyboard's handle and,
  on a touch screen, the part that drags instead of scrolling.

  - `@oppenheimer/design-system-web`: `useSortableItem` returns its
    `listeners`, so a surface can put the pointer's on a box bigger than the
    handle; `SortableTodoRow` puts it on the row.
  - `@oppenheimer/web-showcase`: the TodoRow entry says so.

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

- cf50079: `ChatTable` draws any table in the chat exactly as a reply's Markdown tables are drawn; `ChatReply` and a visual's table now read one set of rules, so the two cannot drift apart.
- 3da961d: A WhatsApp number's Settings lists its groups and saved contacts before anyone writes: the runner reports them on connect and when a group is joined or renamed or the contacts change (the new `whatsapp.chats` frame), and the API keeps them per number (`whatsapp_known_chat`, up to 5,000, forgetting a chat not reported for 7 days). A group set to a bot now wakes it on every message with words, not only a mention or a reply, up to 120 turns an hour per group. People lists the owner first, fixed on the default bot; the "Answered by" filter is searchable and caps its height; the tab counts sit on their label's baseline, and `FacetSelect` takes `size="sm"` so a filter row stands at one height.
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

- fd6277d: Antigravity (Google's `agy`) is an agent a session can run, with Gemini 4
  Neon, Carbon, Argon and Hydrogen, Gemini 3.8 Flash, and Antigravity's Claude
  Opus 5.5 and Sonnet 5.5. Its three permission levels are `--mode default`,
  `--mode accept-edits` and `--dangerously-skip-permissions`; the effort is
  `--effort`, the first task `--prompt-interactive`, and a stopped session
  reopens its conversation with `--continue`. `runner agents install
antigravity` installs `agy` from Google's release, checked against the
  manifest's SHA-512; agy keeps itself current. Terminal only for now, with no
  chat view, and switched on in Settings → Agents.
- 4c29edf: A chat's `/command` mark (`ChatCommand`) is the link blue alone, without the selected wash behind it.
- 1897c8a: A bot's drawn face idles: its eyes blink and glance about now and then and its hat sways a little, each face out of step with the next, and all of it stops under reduced motion.
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
- 340ec45: The composer's chips are tighter. A bot's effort is named on its model chip ("GPT-6.2 Sol Low") and set from the slider at the foot of the model menu, as a session's is; the chip is as wide as the level it shows and holds it while the menu is open. The context meter is a ring, blue until 80% and amber after. Popovers take the 14px popover radius instead of the 28px modal one.
- a956535: A session's chat: Enter on the empty field sends the first queued message now, so Enter twice sends a message into the turn under way. In every composer, Enter while dictating ends the recording and leaves what was said in the field to read; the next Enter sends it.
- 331d29f: Every row of controls in the console's headers and toolbars stands at one height. Calendar's and Milestones' Today and arrows are 34px, level with the view tabs and New event; a pull request's toolbar is 28px throughout; the Inbox's Refresh and Filter are 28px beside the sidebar toggle; Add host's Command / Agent prompt tabs are 28px beside Copy; the routine editor's step tabs and trigger tokens are 28px; the public site's language and theme controls are 28px beside Sign in.
- ac2833a: The chrome's controls stand on the height ramp: the sidebar's search and input are 28px, the number stepper is 28px, and the top bar's search is 34px, level with its buttons. The composers keep their own sizes.
- d0d73b6: Controls already at 28 or 34px take their height from the ramp's tokens (chat suggestions and chips, the tray and viewed buttons, the effort slider, the editor's back link, the task board's foot row). Nothing on screen moves; the last few controls off the ramp stay as they are, by choice.
- e8fd98c: A drop into a folded group lands again. The drag layer keeps the carried item's data from when it was picked up, so once a row carried into a group that draws no rows (a folded project in the console's sidebar) unmounts, its `type` still matches the group's `accepts`. Before, dnd-kit handed back empty data, no target took the item, and the drop went nowhere: a session dragged into a folded project was never moved.
- 170ce4c: A section's Bots heading folds: its label is a toggle, with a chevron shown
  on hover and while folded, and the fold is kept per section on this device.
  `SidebarFoldLabel` is the toggle, passed as a `SidebarListHead` label, and the sidebar's
  stored-list helpers (`storedList`, `useStoredList`, `withFold`) move to
  the platform kit, now that bots and sessions both keep lists on the device.
- d577bfe: fx, Vercel Labs' coding agent (`fx`), is an agent a session can run. It takes
  a model as a Vercel AI Gateway id (`spacexai/grok-4.7` by default), an effort
  with `--effort`, and the three permission levels as its own
  `--permission-mode ask|auto|full-access`; a stopped session reopens its
  conversation with `--continue`. The runner installs it from its GitHub
  release, checked against the release's `.sha256`, into `~/.local/bin`, and
  keeps it current with `fx upgrade`. Terminal only for now, with no chat view.
  Settings → Agents lists it, off on a fresh device, as Pi and Oh My Pi are.
- af020b8: Hermes (`hermes`, Nous Research's agent) is an agent a session can run. It
  starts as `hermes chat` with the first task as `--query`, which on a terminal
  seeds an interactive session, and reopens its conversation with `--continue`.
  It runs the model and approvals its own configuration names (`hermes model`,
  `approvals.mode`), so the picker offers no model, effort or permission chip
  for it, and the runner keeps it current with `hermes update --yes` but does
  not install it: Nous's only installer is a piped script nothing checks.
  Settings → Agents lists it, off on a fresh device, with its mark.

  A Hermes session has a Chat view. Hermes keeps its conversations in SQLite
  (`$HERMES_HOME/state.db`) rather than a transcript file, so the runner reads
  the newest CLI conversation Hermes started in the session's directory since
  the session was created, read only: its prompt, thoughts, tool calls (its
  `terminal`, file and patch tools as Bash, Read, Write and Edit) and replies,
  live, back across a compaction, and starting over on an undo. Bots and `opp`
  read it a page at a time.

- b45eaa5: The Inbox's cards are compact: a 17px title, a smaller sender row, 14px
  body, answer rows and question options at the medium control height, a
  command that scrolls inside a box of at most 9rem, a narrower deck and a
  smaller dock.
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

- d2644b5: Muse (Meta's Muse Code, `muse`) is an agent a session can run. It offers
  Muse Spark 1.3, Muse Spark 1.2 (its default) and Muse Ember 1.0, each with
  `--reasoning-effort` from minimal to ultra, and its three permission levels
  are `--approval-mode untrusted`, `--approval-mode on-request` and `--yolo`.
  `runner agents install muse` installs its launcher, refusing one whose
  response carries no checksum, and the launcher fetches the native binary
  against its release manifest's SHA-256 and keeps it current itself.

  Muse is off in Settings → Agents until switched on, terminal only, and takes
  no task on the command line: New session starts it without one, as it does
  the blank terminal, and the person types the first task in its terminal; a
  restarted session opens a fresh Muse; automations do not offer it, and a bot
  asked to start one is told to pick another agent.

- 5a19d4e: Every row of tabs that switches a view now looks like the automations overview's tabs: the pull request queue's scopes, a bot's SOUL.md / INSTRUCTIONS.md, a project's Overview / Stats, the calendar's views and a pull request's Description / Changes / Chat. `PillTab` takes `mono` for a label that is a file name.
- 9f1bb25: The open bot's face in a folded Bots heading keeps its whole ring: `BotFaces` leaves 4px inside its clip on each side, so the ring, the focus outline and the state dot of the first and last face are no longer cut off.
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

- 0b173cc: Qwen Code (`qwen`, `@qwen-code/qwen-code`) is an agent a session can run, with
  a Chat view. It offers Qwen3.8 Max (its default), Qwen4 Max, Qwen3.7 Plus and
  Qwen3.8 Flash, with Qwen3.7 Max under More models, and no effort level, which
  Qwen takes only as a setting. Its permission levels are `--approval-mode
default`, `auto` and `yolo`. The first task rides as
  `--prompt-interactive=<task>`, one word, so a task that starts with `-` is
  not read as a flag: the runner now replaces `<prompt>` inside a word. A
  restart reopens the session's conversation by id (`--resume <id>`) once Qwen
  has written it, which the runner checks, and before then starts it again
  under the same id (`--session-id <id>`), since `--resume <id>` exits until
  something has been said and `--continue` may open another Qwen's
  conversation in the same folder; where the runner cannot tell, it is
  `--continue`. A session takes no second Qwen window: its conversation
  would read as the one the session's Qwen moved to. The chat shows what the person typed, not
  the `@file` contents or hook context Qwen stores with it. Before a message is
  typed, the runner, the API and the console empty Qwen's prompt, which an Up
  arrow, a stopped turn or a rewind can leave holding text, with Ctrl+E,
  Meta+D and Ctrl+U, which its Rewind dialog does not read.

  `runner agents install qwen` installs it from npm (Node.js 22); the runner
  does not update it, and the guide says how to. The chat reads
  Qwen's conversation file under `~/.qwen/projects/` (or `$QWEN_HOME`), and in a
  worktree session follows the conversation Qwen moves to on a `/clear`. Qwen
  Code is off in Settings → Agents until switched on, and wears Qwen's mark.

- 50cbfa3: A bot's notice in the Inbox can be answered on its card: Reply here opens the bot's chat under the notice, its recent conversation over the composer, so you read what led to the line and reply without leaving the Inbox. `InboxDeck` takes no swipe that starts in a `data-swipe-ignore` region.
- 19d77e6: The project dialog writes repository names in the rows' own 13px type, as the New session repository chip does, where it used mono: the Add a repository pane, the added rows under it, and Cloned by default. Branch names stay mono.
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

- af1ef4f: Session tabs are narrower and no longer jump when a session is created.

  - `@oppenheimer/design-system-web`: a `ChatTab` is 160px while the strip has
    room (240px before).
  - `@oppenheimer/web`: New session keeps the plus's room in the tab strip, so
    the lit New session tab becomes the new session's tab in place and no
    other tab narrows.

- 2d8a637: A settings card's empty row ("No skills yet.") centres its line in the row's height instead of sitting at its top.
- 2e2e0f8: An alert in a sidebar puts its action (Try again, Dismiss) under the sentence, so the sentence takes the column's width.
- a276d29: A sidebar row keeps its attention dot after it is clicked: only keyboard focus swaps the dot and age for the row's ellipsis, so the open session's amber or blue dot no longer hides until focus moves elsewhere.
- 989529f: The sidebar's rows share one grid. A Bots heading's rows take the 12px inset the views above them use, the bots' faces centre on the views' icons and their names start on the same column, and the Milestones row's narrower diamond no longer pulls its name 2px left.
- b589f09: A user's message bubble in a chat is less round: its corners go from the card radius (18px) to the panel radius (14px), so a one-line message no longer reads as a pill. The loading ghosts of a session's and a bot's chat follow it.
- 48349c5: The tab bar over Sessions stands on the terminal's grey everywhere, the same colour on a session, a bot's chat and New session, so it no longer turns black when a session is being created; its toggles, + and Share are the small size again. The shown tab's card is a step lighter than the bar, so it stands out again.
- 205d67a: The tabs over Sessions keep their widths moving between a session and a bot, and while a page loads: the bar's end keeps the room of a session's controls on every page, and a tab whose list is still loading holds its place as a placeholder (`ChatTabSkeleton`).
- 019d67c: `ChatTab`s are one width whatever their names, the way a browser's tabs are:
  240px while the strip has room, then all shrinking alike down to 96px as
  more open, past which the strip scrolls. Lighting a tab no longer widens it
  (its name goes to 500), so clicking one never moves the strip. A strip passed
  as `ChatHeader`'s title fills the bar, and the close of a tab not shown takes
  no room until it is hovered or focused, so a narrow tab keeps its name.
- d5cdd5e: A `TranscriptDivider` with an action (a bot's "Session … was stopped" line with Open session) no longer runs past a narrow chat: its label shrinks, so a long session name truncates instead of pushing the transcript into a sideways scroll, as it did in the Inbox's Reply here.
- 718613c: ZCode (`zcode`, Z.ai's coding agent) is an agent a session can run, as a
  proof of concept read off ZCode 4.0.0's source and not yet watched live. The
  runner probes `zcode` on PATH and starts its TUI with `--mode build|edit|yolo`
  for Ask, Auto and Full access. A restart opens a fresh ZCode: its
  `--continue` exits when nothing was saved yet. ZCode has no `--model` and takes
  no first task on its command line, so its sessions offer no model, the task is
  optional as a blank terminal's is, and the person types the first one in the
  terminal; a bot's `start_session` and `runner sessions run`, whose task is
  required, refuse it. The runner
  does not install it: Z.ai publishes desktop installers and no terminal
  release. Its screen manifest reads `esc to interrupt` as working and the
  approval dialog as waiting on the person. Off in New session's picker until
  switched on in Settings → Agents.

  ZCode has a chat view. ZCode keeps its conversations in one SQLite database
  (`~/.zcode/cli/db/db.sqlite`) in OpenCode's shapes, so the runner reads it
  read-only with OpenCode's chat follower, over a store that stands in for
  OpenCode's API, and leaves out the messages ZCode writes for the model alone.
  ZCode calls those tables an implementation detail: a release that moves them
  breaks the chat view until the reader follows.

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
