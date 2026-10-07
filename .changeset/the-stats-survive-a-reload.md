---
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/api": patch
"@oppenheimer/web": patch
---

The review period's numbers are kept in the browser's cache, so opening
Analytics draws them at once instead of a skeleton. The queue stays out of
storage, and a read's gaps no longer name a repository, so nothing kept there
names one either.
