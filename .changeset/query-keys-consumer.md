---
"@oppenheimer/frontend-consumer": minor
---

`installationsKeys` gains `detail`, `repositoryList` and `repository`; `repositories(id)` is now a scope, and branches are keyed `[..., 'repositories', 'detail', repoId, 'branches']`. Hosts pairing keys are `hostsKeys.pairingTokens()` (`['hosts', 'pairing', 'tokens']`, was `pairings()`) and `currentPairing(name)` (`[..., 'current', { name }]`). `useSession`, `useSessionStartProgress`, `useCheckSlug` and the installation pickers take `undefined` for an input that isn't known yet and fetch with `skipToken`. `useRegister` also invalidates `profileKeys.me()`. Mutation hooks go through `withCacheOnSuccess`.
