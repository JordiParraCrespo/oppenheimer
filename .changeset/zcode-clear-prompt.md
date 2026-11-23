---
"@oppenheimer/shared": patch
"@oppenheimer/runner": patch
"@oppenheimer/api": patch
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/web": patch
---

A message the chat, a bot or another session types into ZCode no longer
lands joined to ZCode's last prompt. ZCode recalls its last prompt into an
empty input on an Up arrow (an approval dialog's, a wheel over the
terminal), and what was typed next was sent after it. An agent's typed-input
spelling can now name `clear` keys sent before a message; ZCode's is Ctrl+U,
which empties its draft. The console's chat composer, the API's prompt typer
(bots, wakes, `opp`) and the runner's `sessions tell` and child reports all
send them; a message whose files were just pasted into the prompt does not
clear them away.
