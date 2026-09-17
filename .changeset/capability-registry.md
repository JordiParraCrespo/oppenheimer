---
"@oppenheimer/shared": minor
"@oppenheimer/backend-core": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/translations": patch
---

Capability registry: a missing optional key disables a feature instead of
booting with a `'not-set'` sentinel.

- `@oppenheimer/shared` exports `DEPLOYMENT_CAPABILITIES` / `DeploymentCapabilities`
  — the catalog of optional features a deployment may or may not have
  (`google_oauth`, `github_oauth`, `stripe_billing`, `s3_storage`,
  `email_delivery`), plus the `CLIENT_CAPABILITIES` wire subset.
- `@oppenheimer/backend-core` gains a `CapabilitiesService` registry: the app
  resolves its capability set from config once at boot, logs it at startup,
  and every consumer asks the registry instead of comparing raw config against
  sentinel values.
- The API's OAuth config keys are now genuinely optional
  (`z.string().optional()`) rather than defaulting to `'not-set'`; blank or
  whitespace-only env vars normalize to `undefined` across the optional
  OAuth/Stripe/S3/email keys. The client-facing subset of the resolved set
  (`CLIENT_CAPABILITIES`: the OAuth providers and `stripe_billing`) is served
  at `GET /health/capabilities` (exempt from scope checks, like other
  anonymous reads); server-internal capabilities stay in the startup log.
- `@oppenheimer/api-client` picks up the generated `HealthApi.deploymentCapabilities()`.
- `@oppenheimer/frontend-core` adds a `capabilities` module and a
  `useDeploymentCapabilities()` hook; the web login page uses it to render
  only configured social providers, and to name the env vars to set when none
  are (only after a successful read — an unreachable API or a failed refetch
  with retained stale data is not a missing configuration).
