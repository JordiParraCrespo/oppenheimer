---
"@oppenheimer/frontend-core": minor
---

Add a shared TanStack Query cache-persistence policy.
`@oppenheimer/frontend-core/react` now exports `defaultQueryClientOptions`,
`createQueryPersistOptions` and `shouldDehydrateQuery`, which an app feeds to
`PersistQueryClientProvider` alongside its platform persister (`localStorage` /
MMKV). The policy pins `gcTime` to the 24h persist window (a garbage-collected
query is never written to storage), busts the cache on app version, and keeps
the kernel's `auth` and `userSettings` queries — plus anything that isn't a
successful fetch — in memory only (`KERNEL_NON_PERSISTED_FEATURES`). A product
names its own on top.

`useSessionRestore` now reconciles the restored cache against the signed-in
user (`reconcileCacheOwner`), dropping it when the session is gone or belongs
to someone else, so a persisted cache can't outlive its session on a shared
browser or device. `AuthService.restoreSession()` returns the restored user's
id (or `null`) to make that possible.
