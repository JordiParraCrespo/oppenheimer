---
"@oppenheimer/backend-agents": patch
---

A ChatGPT turn whose response ChatGPT's backend failed because it was
overloaded (`response.failed` with code `server_is_overloaded`) fails as
`unavailable`, not `other`: the chat says the provider could not be reached and
to try again, and the turn is no longer reported to the error tracker as ours to
fix.
