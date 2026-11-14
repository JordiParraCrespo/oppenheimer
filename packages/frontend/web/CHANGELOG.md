# @oppenheimer/frontend-web

## 0.3.0

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

- c1161c5: Enter sends while you dictate. In New session, a session's chat and a bot's
  chat, Enter (in the field, on the recorder, or with nothing focused once the
  recorder has replaced the field) ends the recording and sends as soon as what
  was said lands in the draft, so the spoken rest is never dropped; a failed
  transcription sends nothing and leaves the draft; Enter on the recorder's
  own buttons stays theirs, so Cancel cancels. `DictationSlot` takes `finish`,
  a promise that settles once the text has landed (`useDictation().finish`),
  and the composers' shared send takes a generic `beforeSend` that holds a
  send until it settles.
- c90bcf1: The console reports its own bugs to Sentry when `VITE_SENTRY_DSN` is set.

  - `@oppenheimer/frontend-core`: `ErrorReportingService` (`app.errors`) over
    an `IErrorReportingClient` port, a no-op by default. It reports a bug of
    ours and drops a request the server answered or the network lost. The
    query client hands it every failure but a 401; `useReportError` and
    `useCaptureError` serve a boundary; sign-in and sign-out set the user, by
    id only.
  - `@oppenheimer/frontend-web`: `createWebErrorReportingClient`, Sentry loaded
    in its own chunk only with a DSN, with no Session Replay and every URL,
    cookie and console breadcrumb scrubbed. `RouteError` and `QueryState`
    report what they catch.
  - `@oppenheimer/web`: wires it, and uploads hidden source maps at build time
    when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_WEB_PROJECT` are set.

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

- ecf6d14: A session's chat copies what was said, as Claude Code on the web does: the
  prompt from under its card, on hover, beside its time, and a settled turn's
  answer (its last words, every reply after its last piece of work) from a
  trail beneath it.

  - `@oppenheimer/frontend-web`: `CopyTextButton` moves here from the bots
    feature, so the session chat and a bot's chat share it.
  - `@oppenheimer/translations`: `sessions.chat` gains `copyMessage` and
    `copyReply`.

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

- 27f034a: The wordmark stands alone: the console's brand row and the auth and public
  pages show "Oppenheimer" without the "Console" suffix. `Wordmark` loses its
  `product` prop, `BrandLogo` is gone (the auth and public chrome draw
  `Wordmark` directly), `AuthLayout` loses its `product` prop, and the
  `common.product` key is gone from the catalogs.

### Patch Changes

- c7a6f7a: Employees sidebar: drag a bot group by its head to reorder the groups (saved
  as the group's position), hide a bot from the sidebar from its row menu, and
  show hidden bots again from a filter menu beside Search bots. Hidden bots are
  kept on this device; a search still finds them, and a drop next to a hidden
  bot keeps its place.
- 170ce4c: A section's Bots heading folds: its label is a toggle, with a chevron shown
  on hover and while folded, and the fold is kept per section on this device.
  `SidebarFoldLabel` is the toggle, passed as a `SidebarListHead` label, and the sidebar's
  stored-list helpers (`storedList`, `useStoredList`, `withFold`) move to
  the platform kit, now that bots and sessions both keep lists on the device.
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

- 02894e4: The Inbox's other cards say more: a bot approval shows the call it wants to run (its input, a line per field), a failed session says why it did not start (the reason its page gives, and the host's own words under it), a failed run shows its exit code and, when there is nothing to open or run again, why, and a pull request ready to merge names its author. Why a session did not start is the kit's `useStartFailure`, shared by the session's page and the Inbox.
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

- 7e7b6dd: A failed run's inbox card reads the host's refusal as words again. The detail
  came from Claude Code's terminal, which writes a cursor move for every space,
  so the card showed "Error:Cloudsessionsneedaclaude.aisign-in." in one
  run-together word. It now goes through the same `readableDetail` the session's
  start failure uses: escapes gone, cursor moves as spaces, one line per line.
- 5396b12: Console: a tab opened before a deploy reloads when a lazily loaded chunk the deploy removed fails to load, instead of emptying the session list under "Could not reach the server" (a row's Delete did).
- bd729af: A chunk a deploy removed no longer breaks the console until the cache expires: nginx answers a missing `/assets/` file with an uncached 404 instead of a cacheable `index.html`, and the stale-build reload no longer swallows the import error, which had made the router crash on "reading 'component'" before the page reloaded (#710, Sentry OPPENHEIMER-WEB-4).
- db80935: A failed start's details from the host read as the host's terminal showed them: escape sequences gone, one line per line, in a monospace block.
- Updated dependencies [e711f5c]
- Updated dependencies [a602949]
- Updated dependencies [566f850]
- Updated dependencies [7b5c7b3]
- Updated dependencies [c9aa79c]
- Updated dependencies [7b0e91d]
- Updated dependencies [1d57cbf]
- Updated dependencies [43193e4]
- Updated dependencies [dfd07de]
- Updated dependencies [50be89a]
- Updated dependencies [1df2b19]
- Updated dependencies [7944eae]
- Updated dependencies [db21b92]
- Updated dependencies [50429c4]
- Updated dependencies [344ce8c]
- Updated dependencies [d314623]
- Updated dependencies [d5d4fd4]
- Updated dependencies [c5c09d0]
- Updated dependencies [be15bdc]
- Updated dependencies [38ffaaf]
- Updated dependencies [e315b92]
- Updated dependencies [a51a958]
- Updated dependencies [089b66c]
- Updated dependencies [b283349]
- Updated dependencies [cfa236a]
- Updated dependencies [434deea]
- Updated dependencies [0d83e40]
- Updated dependencies [08bb08b]
- Updated dependencies [9ccced3]
- Updated dependencies [6568fab]
- Updated dependencies [a7c8731]
- Updated dependencies [c4b0995]
- Updated dependencies [be941d8]
- Updated dependencies [b639f26]
- Updated dependencies [929db14]
- Updated dependencies [4faf606]
- Updated dependencies [3d54930]
- Updated dependencies [8612fd8]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [4201798]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
- Updated dependencies [201ee3a]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
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
- Updated dependencies [c7a6f7a]
- Updated dependencies [6af341b]
- Updated dependencies [0044013]
- Updated dependencies [9716225]
- Updated dependencies [0f9c3ca]
- Updated dependencies [d5ebd8d]
- Updated dependencies [419f41c]
- Updated dependencies [9ddd8a1]
- Updated dependencies [db2a91a]
- Updated dependencies [2128771]
- Updated dependencies [f93ffbe]
- Updated dependencies [3223f4b]
- Updated dependencies [8b529a9]
- Updated dependencies [c11f8a3]
- Updated dependencies [8baff58]
- Updated dependencies [9f858e0]
- Updated dependencies [b39d40f]
- Updated dependencies [33cb1d8]
- Updated dependencies [55acf65]
- Updated dependencies [3230edb]
- Updated dependencies [f6a81a2]
- Updated dependencies [7a8851a]
- Updated dependencies [61f1092]
- Updated dependencies [dc67559]
- Updated dependencies [a956535]
- Updated dependencies [3ffa099]
- Updated dependencies [6eb8d65]
- Updated dependencies [73ce336]
- Updated dependencies [663e8ed]
- Updated dependencies [c1161c5]
- Updated dependencies [e8fd98c]
- Updated dependencies [fc246b3]
- Updated dependencies [c90bcf1]
- Updated dependencies [17e4cd5]
- Updated dependencies [170ce4c]
- Updated dependencies [d68e9c4]
- Updated dependencies [231fb59]
- Updated dependencies [500ddd1]
- Updated dependencies [33cb1d8]
- Updated dependencies [ab9a6f4]
- Updated dependencies [aeeb48b]
- Updated dependencies [d264253]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [85c11ad]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [02894e4]
- Updated dependencies [dd3acdd]
- Updated dependencies [cca8cfb]
- Updated dependencies [ce6374e]
- Updated dependencies [50c9d05]
- Updated dependencies [7c0a70c]
- Updated dependencies [7c0a70c]
- Updated dependencies [35f32be]
- Updated dependencies [c63402e]
- Updated dependencies [fa1a47b]
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
- Updated dependencies [a6d67d7]
- Updated dependencies [723089c]
- Updated dependencies [88f61b5]
- Updated dependencies [9871b11]
- Updated dependencies [250c8d6]
- Updated dependencies [0079b26]
- Updated dependencies [67df985]
- Updated dependencies [0f2f802]
- Updated dependencies [a80436f]
- Updated dependencies [146d7d1]
- Updated dependencies [fa85016]
- Updated dependencies [d4606c6]
- Updated dependencies [19d77e6]
- Updated dependencies [4f9afb3]
- Updated dependencies [1dbae54]
- Updated dependencies [6917f62]
- Updated dependencies [8b772b8]
- Updated dependencies [d69ddc4]
- Updated dependencies [ecf6d14]
- Updated dependencies [d687bfd]
- Updated dependencies [45604ff]
- Updated dependencies [d687bfd]
- Updated dependencies [aa92290]
- Updated dependencies [ea93480]
- Updated dependencies [11fa44a]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [ec96195]
- Updated dependencies [1f7f57b]
- Updated dependencies [6125030]
- Updated dependencies [b5a9490]
- Updated dependencies [1fcf738]
- Updated dependencies [f384b6a]
- Updated dependencies [db80935]
- Updated dependencies [c8c4f9b]
- Updated dependencies [f8eda6e]
- Updated dependencies [db4ae58]
- Updated dependencies [13374f0]
- Updated dependencies [a68c88c]
- Updated dependencies [8283986]
- Updated dependencies [a69aa94]
- Updated dependencies [828d404]
- Updated dependencies [2d187ed]
- Updated dependencies [9706ce9]
- Updated dependencies [5b1c52a]
- Updated dependencies [4ee069d]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
- Updated dependencies [27f034a]
  - @oppenheimer/design-system-web@1.0.0
  - @oppenheimer/translations@0.4.0
  - @oppenheimer/shared@0.4.0
  - @oppenheimer/frontend-core@0.4.0

## 0.2.0

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

- f099524: Ship the PostHog web analytics adapter, driven by `VITE_POSTHOG_KEY`.
- ab97201: Unused code is removed, and each barrel exports only what the console imports; `pnpm check:unused` holds it there.
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
- a66c1fe: - `@oppenheimer/frontend-web`: the `hosts` concern is `pairing`, and its components are `PairingChrome`, `PairingToken`, `PairingStatus`, `PairingCopyButtons` and `PairingInstruction`; `AppPending` and `SessionRestoreError` are added.
  - `@oppenheimer/tsconfig`: the app dependency-cruiser rules add `providers-mount-dialogs` and `features-query-through-the-product`.
  - `@oppenheimer/web`: `features/installations/`.
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

- b32d3b8: - `@oppenheimer/frontend-core`: `useQuery` and `useQueries` that share entities across refetches.
  - `@oppenheimer/frontend-consumer`: every query hook goes through them.
  - `@oppenheimer/frontend-web`: `createDialogSlot` replaces `ConsoleDialogProvider`, `useConsoleDialog` and `useConsoleList`; `SidebarSearchField` is added.
  - `@oppenheimer/design-system-web`: `useNow` shares one timer per interval; `FieldSelect` no longer reads a ref in render.
  - `@oppenheimer/web`: fewer re-renders in the sidebars and the project dialog.
- 1ad71b4: Split `DataTable` so the search field, the selection and the rows stop sharing a clock: a keystroke now re-renders zero rows. `useTableQuery` keeps one `search` — the settled value — and no longer debounces its URL write.
- f099524: Ship `useZodResolver`, which wires `createZodErrorMap` into React Hook Form.
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

- 3e6e3dc: Settings → Hosts, as `design/version1/Settings.dc.html` draws it: a page in its own frame, reached from the account menu, listing the workspace's hosts as cards (status, running sessions, OS · vCPU · runner version, connected or last seen) with inline rename, copy ID and remove, and Add a host opening inside the same frame. `HostCard`, `SettingsNav`, `PageHeader`, `RoutineSteps` and the tabbed `CodeBlock` panel now measure as the version-1 export does.
- 43a17c1: - **frontend-web**: `notifySuccess`, the success toast, which takes a `toasts.*` key.
  - **web**: toasts the writes whose result is easy to miss, and deleting an automation asks through one confirm dialog on the table and on its page.
  - **translations**: success copy under `toasts.*`.
- b9fb2ce: `AuthLayout` drops its `legal` prop. How a page is framed is now route
  `staticData` the layout reads off the innermost match: `authWidth` for the
  column, and `legalNoteKey` for the line under it — absent for the default
  terms-and-privacy line, a key for a page's own, `null` for none. The
  `declare module` block that types them moves into the component, so there is
  no side-effect import to remember.
- a0e23bd: Search params are Zod schemas (`searchText`, `searchFlag`, `searchPage`) and nuqs is removed; the `one-api-client` rule and the removed `sessions.agents` keys ride along.

### Patch Changes

- 99219f9: The console mounts the automations overview, runs, run view, editor and sidebar against the consumer's `automations` module.
- ba9abd0: Timing and retry decisions move to `CORE_CONFIG`
  (`@oppenheimer/frontend-core/config`) and `CONSUMER_CONFIG`
  (`@oppenheimer/frontend-consumer/config`); `createQueryClient`'s `staleTime`
  now defaults to the kernel's. Values are unchanged.
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
- f099524: Follow the `@oppenheimer/config` → `@oppenheimer/tsconfig` rename.
- be76e39: The PostHog adapter drops its queued events, and every call after it, once the
  SDK fails to load, instead of holding them in a long-lived tab for a client
  that never arrives.
- Updated dependencies [24d217d]
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [1a51afc]
- Updated dependencies [eff0947]
- Updated dependencies [9d7efce]
- Updated dependencies [f099524]
- Updated dependencies [2063d42]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [99219f9]
- Updated dependencies [1ed003e]
- Updated dependencies [080641e]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [669b0d3]
- Updated dependencies [cb56034]
- Updated dependencies [287d688]
- Updated dependencies [a880b19]
- Updated dependencies [a0e23bd]
- Updated dependencies [7945f7e]
- Updated dependencies [1094480]
- Updated dependencies [9431938]
- Updated dependencies [08d42f1]
- Updated dependencies [121d28a]
- Updated dependencies [c983201]
- Updated dependencies [c5437b1]
- Updated dependencies [09cea4c]
- Updated dependencies [f099524]
- Updated dependencies [ba9abd0]
- Updated dependencies [ab97201]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [c078d0d]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [94a700e]
- Updated dependencies [88f7898]
- Updated dependencies [e717f42]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [c05c4ff]
- Updated dependencies [ed28ce2]
- Updated dependencies [d5d310c]
- Updated dependencies [1c2ae71]
- Updated dependencies [473557a]
- Updated dependencies [f099524]
- Updated dependencies [2dc27d2]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [0918701]
- Updated dependencies [0918701]
- Updated dependencies [a23b14e]
- Updated dependencies [8d78094]
- Updated dependencies [173bb4c]
- Updated dependencies [cefbc53]
- Updated dependencies [2d84b28]
- Updated dependencies [c412130]
- Updated dependencies [bfa1020]
- Updated dependencies [9ffae03]
- Updated dependencies [6b943c3]
- Updated dependencies [b32d3b8]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [dcc5fe1]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
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
- Updated dependencies [3e6e3dc]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [c237a5f]
- Updated dependencies [b336aae]
- Updated dependencies [43a17c1]
- Updated dependencies [0e5fd26]
- Updated dependencies [0e25c03]
- Updated dependencies [4ffcdd6]
- Updated dependencies [ab97201]
- Updated dependencies [f099524]
- Updated dependencies [818f20c]
- Updated dependencies [e647495]
- Updated dependencies [8d66c87]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [a0e23bd]
  - @oppenheimer/translations@0.3.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/design-system-web@0.2.0
  - @oppenheimer/frontend-core@0.3.0
