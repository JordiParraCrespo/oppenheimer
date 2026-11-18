---
'@oppenheimer/runner': patch
---

An OpenCode session's chat shows the conversation its own OpenCode is working
in. When two OpenCodes ran in one folder (two direct sessions in the same
directory, or one run by hand beside a session), the chat showed whichever
conversation had been touched last, often the other one's, while the terminal
showed the session's own. The runner now goes by the OpenCode process's own
event stream, remembers each session's conversation while the chat is closed,
and still follows `/new`.
