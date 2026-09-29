---
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

A session whose agent has not drawn yet says so, instead of showing a white
rectangle.

The host reports a session started once tmux holds it, which is before the
agent inside has painted anything — a few seconds cold, and thirty-five of them
on a machine under load. The provisioning pane has handed over by then, so the
reader got an empty pane with a live status dot and no way to tell a slow start
from a broken session.

The terminal now covers the grid with "Waiting for the agent" until the first
byte that would put a glyph on it. Not the first byte: an attachment opens with
tmux's own preamble — a device-attributes query, the cursor put home, a clear —
which is bytes that paint nothing, so the cover has to read the escape grammar
rather than count bytes. A reconnect replays the scrollback, so a session that
has run before never shows it.
