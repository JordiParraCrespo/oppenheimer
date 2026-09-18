---
"@oppenheimer/frontend-core": minor
---

Add a pluggable `analytics` module with feature flags: an adapter implements `getFeatureFlags()`, and `NoopAnalyticsClient` stands in whenever no provider is configured.
