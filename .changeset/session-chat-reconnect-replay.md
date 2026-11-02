---
'@oppenheimer/frontend-consumer': patch
---

A long session chat no longer empties and refills when its stream
reconnects (the tab comes back, the network blips, the host returns). The
runner sends the whole transcript again, in batches of up to 256 entries,
and the chat used to start over on the first batch: it dropped to the oldest
turns, drew every turn afresh and threw the reader to the top of the
conversation, with the whole history drawn. A reset that carries lines is now
checked against the lines the chat already holds. What matches stays drawn
and nothing is published. The chat is rebuilt only from the first line that
differs, and lines past the end of the replay are appended as usual. A replay that
goes quiet before it has resent every line the chat holds means the
transcript is now shorter, and the lines it did not resend are dropped.
