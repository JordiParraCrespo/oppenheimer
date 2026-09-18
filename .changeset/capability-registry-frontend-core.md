---
"@oppenheimer/frontend-core": minor
---

Add a `capabilities` module and a `useDeploymentCapabilities()` hook, so a
consumer renders only the social providers a deployment actually has
configured — and only after a successful read, since an unreachable API or a
failed refetch with retained stale data is not a missing configuration.
