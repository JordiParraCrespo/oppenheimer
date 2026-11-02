---
'@oppenheimer/frontend-consumer': patch
'@oppenheimer/web': patch
---

A long session chat stays light while the agent writes. Each turn subscribes
to its own record, so a line of the transcript redraws the turn it lands in
instead of every turn on screen (40 → 1 per line). A result that lands on an
earlier turn's call (a background command that finished after the next
prompt) rebuilds the chat from that turn, not from the start of the
conversation.
