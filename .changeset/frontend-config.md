---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
---

Timing and retry decisions move to `CORE_CONFIG`
(`@oppenheimer/frontend-core/config`) and `CONSUMER_CONFIG`
(`@oppenheimer/frontend-consumer/config`); `createQueryClient`'s `staleTime`
now defaults to the kernel's. Values are unchanged.
