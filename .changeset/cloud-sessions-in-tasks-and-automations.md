---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
---

Cloud sessions in tasks and automations. A task's Start session and an
automation's runs pick where the session runs, as New session does: on a
host, in Claude Code's cloud started from a host, or in Cursor's cloud on the
person's key with no host (`AUTOMATION_PLACES`). `POST /tasks/{id}/sessions`
takes a vendor launch under `cloud` beside New session's `session`; an
automation's revision carries `place`, with `hostId` null at a vendor
(migration `AddAutomationPlaces`). A run in the cloud holds no place on a
host, and one whose owner has no key for the vendor pauses the automation as
`cloud_key_missing`.
