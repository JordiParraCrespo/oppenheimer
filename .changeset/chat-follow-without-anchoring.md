---
'@oppenheimer/design-system-web': patch
---

`useStickToBottom` turns off scroll anchoring on its scroller while it follows
the end, and turns it back on once the reader scrolls away. A chat that keeps
a window of its latest messages drops the oldest from the top as new ones
arrive. The browser's anchoring moved the view up by the height that left,
the hook read that move as the reader leaving the end, and it stopped
following. In a bot chat whose conversation fills the API's window, a burst
of new messages could leave it stuck partway up with the chevron showing.
While the reader is up in the conversation, anchoring still keeps their place.
