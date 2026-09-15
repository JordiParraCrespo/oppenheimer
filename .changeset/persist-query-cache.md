---
"@oppenheimer/frontend": minor
---

Add a shared TanStack Query cache-persistence policy.

`@oppenheimer/frontend/react` now exports `defaultQueryClientOptions`,
`createQueryPersistOptions` and `shouldDehydrateQuery`, which `apps/web` and
`apps/mobile` feed to `PersistQueryClientProvider` alongside their platform
persister (`localStorage` / `AsyncStorage`). The policy pins `gcTime` to the
24h persist window (a garbage-collected query is never written to storage),
busts the cache on app version, and keeps `auth` and `apiTokens` queries — plus
anything that isn't a successful fetch — in memory only.

`useSessionRestore` now reconciles the restored cache against the signed-in
user (`reconcileCacheOwner`), dropping it when the session is gone or belongs
to someone else, so a persisted cache can't outlive its session on a shared
browser or device. `AuthService.restoreSession()` returns the restored user's
id (or `null`) to make that possible.
