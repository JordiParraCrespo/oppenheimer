---
"@oppenheimer/api": patch
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/shared": patch
---

The polls the workspace event stream covers stand down while it is live: the session list, a session's row and a pending pairing token poll again the moment the stream drops. The API ends every stream on a replica whose Redis subscriber connection closes, so a console is never live and deaf, and the console refetches what the stream covers each time it comes up, the first connect included.
