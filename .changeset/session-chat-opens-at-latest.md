---
'@oppenheimer/web': patch
---

A long session chat opens at its latest turn. Its history arrives in chunks,
and as each one landed the chat dropped its oldest turns to keep drawing the
latest 40. The browser's scroll anchoring shifted the view up to make up for
the turns that left the top, and the chat read that shift as the reader
scrolling away from the end. It stopped following, and the chat stayed
partway up the conversation with "Jump to latest" showing. The chat's
scroller now has no scroll anchoring; the chat already keeps the reader's
place itself.
