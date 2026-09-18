---
"@oppenheimer/frontend-core": minor
---

Add a pluggable `analytics` module with feature-flag support, following the
same platform-adapter pattern as `storage` and `authClient`: an
`IAnalyticsClient` port, an `AnalyticsService` that wraps every provider call
so a failing SDK can never break the app, a typed event catalog, and a
`NoopAnalyticsClient` used whenever no provider is configured.

`OppenheimerApp.create()` takes an optional `analytics` adapter. The React entry
point follows the same queries-and-mutations split as the other feature
modules: `useFeatureFlags`, `useFeatureFlag`, `useFeatureFlagValue` and
`analyticsKeys` for reads; `useCaptureEvent` and `useCapturePageView` for
writes, with `useCaptureOnMount` and `usePageView` as convenience wrappers.
`useAnalytics` remains for calls the module doesn't wrap. Sign-in, sign-up,
sign-out and password-reset events are captured from `AuthService`, which also
identifies the user on login and resets identity on logout.

Feature flags are served through TanStack Query rather than a provider-specific
subscription: an adapter implements a single async `getFeatureFlags()`, and
caching, deduplication and refetching come from the query client. Providers
that can push flag changes may also implement the optional `onFeatureFlags`,
which invalidates the query when it fires.
