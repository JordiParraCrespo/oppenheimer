---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": major
"@oppenheimer/web": patch
---

The persisted query cache stores only what is listed. `createQueryPersistOptions` takes `persistedFeatures` (an allow-list) instead of `nonPersistedFeatures`; the kernel keeps `featureFlags`, `capabilities` and the cache owner, a read can still opt in with `PERSIST_META`, and `CONSUMER_NON_PERSISTED_FEATURES` is now `CONSUMER_PERSISTED_FEATURES` (the permission catalog). A feature nobody listed used to be stored and came back as plain JSON: the workspace list's `createdAt` restored as a string. The cache revision moves to 5, so caches written under the old policy are dropped.

The workspace event stream's refreshes and the polls it stands down are one table per event, and standing down is opt-in: a poll kind says `streamCanCover: true`, and only a read the stream announces in full stands down. A new poll kind, or a new read inside a feature the stream refreshes in part (a tasks read other than the list and the milestones), keeps polling.
