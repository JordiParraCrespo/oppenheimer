---
"@oppenheimer/api": minor
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

A session can be shared with a link: to watch or to type, for anyone, any
signed-in account, or the accounts it names by verified email
(`product/versions/mvp/21-session-share-links.md`).

- `@oppenheimer/api`: `session_share_link`, and `POST/GET /v1/sessions/{id}/share-links`,
  `DELETE /v1/sessions/{id}/share-links/{linkId}`, `POST /v1/shared-sessions/lookup` and
  `POST /v1/shared-sessions/attach-ticket` (signed out allowed). A link's ticket is
  judged by the relay as its creator's, on redemption and every minute; a read-only
  link's keystrokes are dropped. New codes `SESSIONS_021`–`SESSIONS_024`.
- `@oppenheimer/runner`: `session.attach` with `readOnly` attaches tmux with
  `-f read-only,ignore-size` and drops the attachment's input.
- `@oppenheimer/shared`: the share-link schemas, and `readOnly` on `session.attach`.
- `@oppenheimer/frontend-consumer`: `useShareLinks`, `useCreateShareLink`,
  `useRevokeShareLink`, `useSharedSession` and `useSharedSessionStream`;
  `useHostPresence` takes `enabled`.
- `@oppenheimer/web`: Share… in a session row's menu, and the `/shared` page.
- `@oppenheimer/translations`: `sessions.share.*`, `sessions.shared.*`, and the new codes.
