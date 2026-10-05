---
"@oppenheimer/frontend-web": patch
---

The PostHog adapter drops its queued events, and every call after it, once the
SDK fails to load, instead of holding them in a long-lived tab for a client
that never arrives.
