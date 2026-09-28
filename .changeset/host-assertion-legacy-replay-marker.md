---
"@oppenheimer/api": patch
---

A host boot assertion used in the five and a half minutes before the deploy that
moved cache keys under `cache:` can no longer be replayed once after it. The
replay guard also honours the unprefixed marker a replica wrote before the
prefix (`LegacyReplayMarkerPort`, one `EXISTS`). The check is for one release:
every such marker has expired by the next one, and it is marked for removal then.
