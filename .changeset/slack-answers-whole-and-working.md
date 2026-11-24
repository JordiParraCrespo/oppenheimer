---
"@oppenheimer/api": patch
"@oppenheimer/shared": minor
---

Slack: a bot's answer arrives in one message up to 39,000 characters instead of being cut at 3,900; the owner's message carries a 👀 reaction from when its turn starts until its answer; people mentioned reach the bot by name rather than by id; images the owner shares (up to four) reach the bot as a console message's do; and secrets in what goes to Slack are sent as `[redacted]`. The app manifest also asks for `reactions:write`, `users:read` and `files:read`; an app made before works without them.
