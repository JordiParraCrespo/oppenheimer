---
"@oppenheimer/api": patch
---

Bots: `stop_session` and `close_session` share one path (look up the session, refuse one the tool may not touch, run the sessions' own command, answer done or waiting on the host), and the rule that a bot closes only a bot's session is a named policy. A cloud session's close now answers that it is closed rather than that it waits on a host, a stop to an offline host says it did not arrive and is not sent again, and the refusal reads "an automation session".
