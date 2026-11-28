---
"@oppenheimer/runner": minor
"@oppenheimer/shared": patch
---

Host sessions in the Claude app. `runner remote-control on` makes a host's
Claude Code sessions start with Claude Code's own Remote Control, so they also
open in the Claude app and on claude.ai/code under the account the host's
`claude` is signed in as. Off by default; a session takes it at its next start
or restart, and `runner remote-control` shows the switch and the account.
