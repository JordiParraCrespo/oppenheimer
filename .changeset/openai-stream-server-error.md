---
"@oppenheimer/backend-agents": patch
---

An OpenAI turn whose stream OpenAI opened and then failed on its side (an
`error` event, or a `response.failed` response, saying `server_error`: "An
error occurred while processing your request") fails as `unavailable`, not
`other`. The chat says OpenAI could not be reached and to try again, and the
turn is no longer reported to the error tracker as ours to fix. A
`response.failed` turn also shows OpenAI's own words instead of the SDK's
"unsuccessful terminal state".
