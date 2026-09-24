---
"@oppenheimer/api": patch
---

The browser attach socket keeps the frames a browser sends while its ticket is
redeemed. The console sends its viewport the moment the socket opens; when the
ticket lookups ran longer than that, `ws` dropped the frame with no listener,
and the relay waited out its two-second viewport timer before attaching at
80x24. A browser that closes during redemption no longer leaves an attachment
open on the link.
