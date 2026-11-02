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

It also lets go of the end only when the reader scrolls up: a wheel turned
up, a touch, an up key, or a press on the scrollbar. When content shrinks for
a frame, the browser clamps the view up itself and reports that a frame
later, by which time the content may have grown back. The hook used to read
that as the reader leaving the end, so a long session chat could stop one
screen short of its end while its history loaded. A move up the reader did
not make now scrolls back to the end.
