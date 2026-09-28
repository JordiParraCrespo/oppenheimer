---
"@oppenheimer/go-ws": patch
---

`Pump` returns ctx's error when ctx ends mid-write, not the closed-connection failure the library reports.
