---
"@oppenheimer/frontend-consumer": minor
---

Installation repositories and branches are keyed under `installationsKeys.detail(id)` and read with `skipToken` until their ids are known; removing an installation drops its subtree. Host pairing keys share one `hostsKeys.pairings()` scope (`pairingTokens()`, `currentPairing(name)`). `useRegister` keeps its cache update when a caller passes `onSuccess`.
