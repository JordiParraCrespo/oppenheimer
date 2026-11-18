---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A reply typed in a Claude Code cloud session's chat wakes the session when
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
