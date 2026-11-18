---
'@oppenheimer/runner': patch
---

An OpenCode session's chat shows the conversation its own OpenCode is working
in. When two OpenCodes ran in one folder (two direct sessions in the same
directory, or one run by hand beside a session), the chat showed whichever
conversation had been touched last, often the other one's, while the terminal
showed the session's own. The runner now listens to each live session's
OpenCode on its own event stream, chat open or not, keeps the conversation it
works in on the session (through a restart of the runner or the session), and
still follows `/new`.
