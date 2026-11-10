---
"@oppenheimer/frontend-consumer": patch
---

The workspace event stream refetches each read at most once every two seconds, the session list's own poll pace: a burst of `session.changed` events from working agents no longer sends one session-list and host-list read per event from every tab, which ran into the API's per-route limit and showed "You're sending requests too quickly" in the sidebar.
