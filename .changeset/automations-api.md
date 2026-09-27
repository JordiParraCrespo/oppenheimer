---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
---

Automations: a saved prompt that starts a session on a schedule, on a GitHub
event, or on Run now. The inbound-events hub receives and normalizes external
events (GitHub first); the matcher, the scheduler and the guards decide which
automations fire; the dispatcher starts each run as a session of the owner.
Runs, the run-history chart and the table are read models over the sessions
they started.
