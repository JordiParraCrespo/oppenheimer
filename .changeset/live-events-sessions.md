---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

Live events, slice 1: behind the `live_events` flag, the console hears which of the workspace's sessions changed over one server-sent stream (`GET /v1/live`) instead of polling for it. The API fans session domain events out over Redis pub/sub; the session list and a session's row stop polling while the stream is up and poll again when it drops.
