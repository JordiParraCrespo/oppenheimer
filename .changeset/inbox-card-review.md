---
"@oppenheimer/web": patch
"@oppenheimer/frontend-web": patch
"@oppenheimer/translations": patch
---

The Inbox's other cards say more: a bot approval shows the call it wants to run (its input, a line per field), a failed session says why it did not start (the reason its page gives, and the host's own words under it), a failed run shows its exit code and, when there is nothing to open or run again, why, and a pull request ready to merge names its author. Why a session did not start is the kit's `useStartFailure`, shared by the session's page and the Inbox.
