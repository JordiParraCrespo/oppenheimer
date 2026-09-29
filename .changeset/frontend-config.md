---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
---

The frontend's timings and limits live in two config objects instead of at
their call sites: `CORE_CONFIG` (`@oppenheimer/frontend-core/config`) for the
generic ones — query stale time and persisted-cache age, clock ticks, input
debounces, the "Copied" confirmation — and `CONSUMER_CONFIG`
(`@oppenheimer/frontend-consumer/config`) for the console's — poll intervals,
the session close watch, the stream's reconnect ladder, resize settle and
cursor frame, page sizes, and per-query cache lifetimes. Values are unchanged.
