---
"@oppenheimer/shared": minor
---

The query and body schemas the session routes validate against, and the
`session_namer` capability.

`ENDPOINT_POLICIES` is now keyed by **method and route**, so closing a session and
reading one are two entries instead of one ambiguous path.
