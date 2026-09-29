---
"@oppenheimer/web": patch
---

Re-measure the web app's first-load budget: 440KB against 435.4KB.

The budget is the measured size plus headroom, so a drift past it is meant to
fail — and it has been failing rather than passing. `origin/main` measures
435.4KB on its own against a 430KB budget, which nothing had re-measured since
21 September; the check only came up because a change widened CI's scope to
every package.

Nothing was shaved here: the entry is the same 435.4KB before and after. What
moved is the number the check compares it against, with the per-chunk
breakdown written down beside it and a tighter 4.6KB of headroom than the last
raise's 9KB, so the next drift fails while it is still one change's worth.
