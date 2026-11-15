---
"@oppenheimer/api": patch
---

A bot that hits a failed step steps back to what the step was for and tries another way before it reports. When a session it started fails because of the host it picked (the agent not signed in or not installed), it starts the task on another host that can run it, asking first under Approve for me, instead of only offering to.
