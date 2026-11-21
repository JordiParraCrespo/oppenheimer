---
'@oppenheimer/api': minor
---

A session is named once more as its conversation goes on. After the agent answers the person's second prompt, the model titles the session again from their prompts so far (never the agent's answers), recorded as `session.named` with `source: conversation`. It happens once per session, needs a configured model, and never replaces a name a person typed: a rename at any time stops it for good.
