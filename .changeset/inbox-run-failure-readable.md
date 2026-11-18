---
"@oppenheimer/web": patch
"@oppenheimer/frontend-web": patch
---

A failed run's inbox card reads the host's refusal as words again. The detail
came from Claude Code's terminal, which writes a cursor move for every space,
so the card showed "Error:Cloudsessionsneedaclaude.aisign-in." in one
run-together word. It now goes through the same `readableDetail` the session's
start failure uses: escapes gone, cursor moves as spaces, one line per line.
