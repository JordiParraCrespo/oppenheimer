# @oppenheimer/mcp

## 0.2.0

### Minor Changes

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

- 9871b11: Plan's board drops the Later column and gains In review, between In
  progress and Done: `TASK_STATUSES` is `todo`, `doing`, `review`, `done`.
  A migration moves every task in Later to the end of To do, in its order,
  and bumps its version. Attaching a session still moves a task in To do to
  In progress. The CLI's and MCP server's status choices, the bots' plan
  tools and `tasks.columns` follow.
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

### Patch Changes

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
- Updated dependencies [4faf606]
- Updated dependencies [3d54930]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
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
- Updated dependencies [6af341b]
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
- Updated dependencies [6eb8d65]
- Updated dependencies [17e4cd5]
- Updated dependencies [d68e9c4]
- Updated dependencies [500ddd1]
- Updated dependencies [33cb1d8]
- Updated dependencies [ab9a6f4]
- Updated dependencies [aeeb48b]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [7c0a70c]
- Updated dependencies [c63402e]
- Updated dependencies [0ed584c]
- Updated dependencies [814aa6c]
- Updated dependencies [5b48b5e]
- Updated dependencies [9b0c57f]
- Updated dependencies [6bb3a80]
- Updated dependencies [a3cf769]
- Updated dependencies [a3a780b]
- Updated dependencies [da6226c]
- Updated dependencies [3b5d381]
- Updated dependencies [9871b11]
- Updated dependencies [250c8d6]
- Updated dependencies [a80436f]
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
- Updated dependencies [5b1c52a]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
  - @oppenheimer/shared@0.4.0
  - @oppenheimer/http-client@0.2.0
