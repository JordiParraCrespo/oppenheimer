---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

Add server-evaluated feature flags, wired into the API and the console.

Flags are declared in code, targeted in the database, evaluated on the server
and read on every client from one endpoint — the shape Stripe and Revolut
describe for their own. Ported from the Flama starter.

- **`@oppenheimer/shared`** gains `feature-flags/`: the `FEATURE_FLAGS` catalog
  (every flag the code may read, with its kind, owner, safe default and — for
  temporary flags — expiry), the pure evaluator (ordered rules, segments,
  semver targeting on the app build, deterministic MurmurHash3 percentage
  splits bucketed by organization), and the Zod schemas for targeting writes.
  Like `agents` and `protocol` it is reached through its own subpaths, not the
  root barrel: `@oppenheimer/shared/feature-flags`, and the Zod-free
  `@oppenheimer/shared/feature-flags/catalog` for the web bundle. A `flags`
  scope group, a `FeatureFlag` subject and a `GET /feature-flags/admin`
  endpoint policy join the catalogs.
- **`@oppenheimer/api`** gains a `feature-flags` module. Every replica holds
  all targeting in memory and evaluates without I/O, polling a cheap
  fingerprint to stay in sync and keeping its last good snapshot through a
  database blip. `GET /v1/feature-flags` serves the caller's evaluated client
  flags (signed out too); the endpoints under `/v1/feature-flags/admin`,
  `/segments` and `/changes` edit targeting, pull kill switches, manage
  segments, explain an evaluation and read the audit trail, which every change
  lands on through the outbox. `@RequireFlag('key')` gates a route on a flag,
  and token creation is now behind the `api_token_creation` kill switch. New
  error codes `FLAG_001`–`FLAG_007`. Migration `AddFeatureFlags`, every point
  in time `timestamptz`.
- **`@oppenheimer/api-client`**: the regenerated client carries the feature
  flag operations and DTOs.
- **`@oppenheimer/frontend-core`**: a `feature-flags` kernel module and
  `useFeatureFlag` / `useFeatureFlagValue` / `useFeatureFlags`, typed by the
  catalog, reading the API rather than PostHog. Flags are prefetched as soon as
  the session is known, persisted with the query cache, and an `experiment`
  flag records a `feature_flag_exposed` event. `OppenheimerApp.create` takes
  `featureFlags: { platform, appVersion }`.

  **Breaking:** feature flags leave the analytics port. `IAnalyticsClient` no
  longer has `getFeatureFlags` / `onFeatureFlags`, `AnalyticsService` no longer
  serves flags, `analyticsKeys.flags` is gone, and `isFlagEnabled` moved to the
  `feature-flags` module. `useFeatureFlag(key)` keeps its name but now takes a
  catalog key and reads the server's answer.
- **`@oppenheimer/frontend-web`**: the PostHog adapter drops its flag methods
  and switches PostHog's own flag loading off.
- **`@oppenheimer/translations`**: messages for `FLAG_001`–`FLAG_007`, and the
  control-plane copy for a flags screen (`control.flags`, `nav.featureFlags`).
- **`@oppenheimer/web`** reports its platform and build when it asks for its
  flags.

`pnpm check:flags` (in CI) fails on a temporary flag past its expiry date and
on a flag the catalog declares but no code reads.
