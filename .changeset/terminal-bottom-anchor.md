---
"@oppenheimer/web": minor
---

The session terminal keeps the agent's prompt at the bottom of the pane. When
the screen is mostly empty (a fresh session, or right after `clear`) the grid's
picture moves down so the prompt box sits on the last rows, like a chat
composer. A full screen, or a reader scrolled back, is left where it is.

The same pass tightens the terminal:

- The PTY hears a resize once a drag settles (100 ms), not on every frame.
- Shift+Enter is a newline in the agent's prompt rather than a submit.
- Ctrl+C with a selection copies it, and Ctrl+Shift+V pastes. Option-click
  forces a selection on macOS, since tmux owns plain drags.
- A lost WebGL context refits the grid for the DOM renderer, and later
  terminals in the tab skip WebGL.
- A font that loads late (the bundled symbols face) drops the glyphs cached
  from its stand-in.
