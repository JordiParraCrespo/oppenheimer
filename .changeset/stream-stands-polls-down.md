---
"@oppenheimer/api": patch
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/shared": patch
---

The polls the workspace event stream covers stand down while it is live: every package poll goes through `usePollWhile(kind, queryKey, active)`, and one coverage table in `workspace-events.ts` says which keys stand down (sessions, their start steps, a pending pairing token) and which only catch up (presence, automation runs); they poll again the moment the stream drops. The API ends every stream on a replica whose Redis subscriber connection closes, so a console is never live and deaf, and the console refetches what the stream covers each time it comes up, the first connect included.
