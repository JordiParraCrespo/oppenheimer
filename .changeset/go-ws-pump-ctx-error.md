---
"@oppenheimer/go-ws": patch
---

`Pump` and `PumpChan` return the context's error when it ends, as documented. A write or ping that the context cut short used to be reported as a socket failure ("use of closed network connection"), and a busy source only noticed the context through its next write.
