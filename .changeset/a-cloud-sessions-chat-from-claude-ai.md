---
"@oppenheimer/extension": minor
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": patch
---

A Claude Code cloud session's chat reads in the console the way it reads in
the Claude apps, your messages included, for every cloud session, not only the
ones the console launched, and a reply typed in the console reaches the
session at once.

- `@oppenheimer/extension`: connected to Oppenheimer, it reads each moving
  session's event log from claude.ai with the sign-in in Chrome and sends it
  to the console, and posts the replies typed there on claude.ai as the
  person's message.
- `@oppenheimer/api`: `POST /v1/sessions/cloud-events` (adopts a session it
  did not start), `POST /v1/sessions/cloud-replies/claim` and
  `…/{replyId}/release`; replies gain the `browser` delivery, and
  `GET /v1/sessions/{id}/cloud-chat` says which source it serves.
- `@oppenheimer/shared`: the schemas for both.
- `@oppenheimer/frontend-consumer`: the cloud chat reads again from its first
  line when the extension's lines replace the hook's, and shows a reply the
  extension posted as sent until it is back.
- `@oppenheimer/web`: the repository hooks the setup panel hands out run from
  the project root, and the privacy page says what the extension now carries.
