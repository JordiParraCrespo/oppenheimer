---
'@oppenheimer/frontend-consumer': patch
---

A session chat whose transcript is over 4MB now also draws its history once,
at its end, on a first load. The runner reads a transcript 4MB at a time and
ends each read on a short batch, and the chat took any short batch as the end
of the history. On dev, a 7.8MB conversation appeared at turn 657, where the
first read ended, then slid through the remaining 640 turns. A short batch
now ends a first load only when it is the first one: a read that fills less
than one batch stopped at the end of the file, so the whole history fit in
it and the chat draws at once. Any longer history ends on the half-second
quiet after the runner's last read.
