---
"@oppenheimer/go-ws": patch
---

`Pump` and `PumpChan` return the context's error when the context ends during a write or a ping, and a pump whose source always has a frame stops as soon as its context ends.
