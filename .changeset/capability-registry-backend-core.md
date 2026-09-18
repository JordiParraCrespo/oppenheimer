---
"@oppenheimer/backend-core": minor
---

Add a `CapabilitiesService` registry: the app resolves its capability set from
config once at boot, logs it at startup, and every consumer asks the registry
instead of comparing raw config against a `'not-set'` sentinel.
