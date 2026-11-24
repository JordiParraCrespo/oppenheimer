---
"@oppenheimer/api": patch
"@oppenheimer/shared": minor
---

Slack: a bot's answer arrives in one message up to 39,000 characters instead of being cut at 3,900; the owner's message carries a 👀 reaction while the bot works on it; people mentioned reach the bot by name rather than by id; and secrets in what goes to Slack are sent as `[redacted]`. The app manifest also asks for `reactions:write` and `users:read`; an app made before works without them.
