---
"@oppenheimer/shared": minor
---

Every boolean feature flag defaults to `true`: a feature launches on, and its
flag is how it is turned off or narrowed. `workspace_event_stream`,
`terminal_direct_path` and `session_chat_view` now serve on until targeting
says otherwise, and `pnpm check:flags` fails a boolean flag that defaults to
`false`.
