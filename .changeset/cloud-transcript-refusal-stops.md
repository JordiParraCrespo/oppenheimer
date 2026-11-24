---
'@oppenheimer/web': patch
---

The cloud chat hook's transcript streamer stops once the API has refused its session for ten minutes (a cloud session this workspace did not launch, or one resolved in the console while its agent runs on) instead of posting every ten seconds for as long as the agent lives. Rate limits, timeouts and server errors are still retried without end, and a session the console learns of a little late still gets its whole transcript.
