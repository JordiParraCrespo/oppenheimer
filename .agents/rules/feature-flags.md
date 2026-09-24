---
paths:
  - "apps/**/*"
  - "packages/shared/src/feature-flags/**/*"
  - "packages/frontend/**/*"
---

# Feature Flags Rules

Flags are declared in code, targeted in the database, evaluated on the server,
and read on every client from one endpoint. That is the shape Stripe and
Revolut describe for their own: every API process holds all flags in memory
and evaluates without I/O; clients receive evaluated values, never rules; a
kill switch is a data change, not a deploy.

| Piece | Where |
| --- | --- |
| The catalog — every flag that exists | `packages/shared/src/feature-flags/catalog.ts` |
| The evaluator (pure, shared) | `packages/shared/src/feature-flags/evaluate.ts` |
| Targeting, segments, audit trail, `@RequireFlag` | `apps/api/src/feature-flags/` |
| Client reads (`useFeatureFlag`) | `packages/frontend/core/src/react/feature-flags.queries.ts` |
| Hygiene check (expired / unread flags) | `pnpm check:flags` (CI) |

## Adding a flag

1. Add the entry to `FEATURE_FLAGS`. Pick the `kind` honestly:
   - `release` — hides unfinished work. **Needs `expiresAt`.**
   - `experiment` — splits traffic between variants. **Needs `expiresAt`**;
     reading it records an exposure.
   - `ops` — a kill switch or knob. Permanent.
2. `defaultValue` is the **safe** answer — what everyone gets before targeting
   is saved and whenever the flag service cannot answer. New feature: `false`.
   Kill switch over something already live: `true`.
3. `client: false` unless a client renders something differently for it.
4. Read it. `pnpm check:flags` fails on a flag nothing reads.

The API ignores database rows whose key is not in the catalog, and every
reader is typed against it — a typo is a compile error, a deleted flag breaks
every reader the compiler then names.

## Reading a flag

```ts
// Client — typed by the catalog; the default until flags load.
const enabled = useFeatureFlag('api_token_creation');
const arm = useFeatureFlagValue('checkout_copy'); // 'control' | 'bold'

// A flow that must not flip mid-way (checkout, transfer, multi-step form)
const enabled = useFeatureFlag('new_checkout', { sticky: true });

// Server — gate the capability, not just the button
@Post()
@RequireFlag('api_token_creation')
create() {}

// Server — anywhere else
constructor(@Inject(FLAG_EVALUATOR) private readonly flags: FlagEvaluatorPort) {}
this.flags.isEnabled('api_token_creation', flagContextOf(request));
```

**A flag that gates a capability gates it on the server too.** Hiding a button
is not a rollout — the endpoint behind it is reachable by anyone with a token.
Read the same key with `@RequireFlag` on the route.

`useFeatureFlag`, `@RequireFlag` and `isEnabled` take **boolean flags only**.
A variant flag has no off — its control arm is a variant like any other — so
read it with `useFeatureFlagValue` / `valueOf` and branch on the name.
`@RequireFlag` sees only who is calling, not the `platform` or `appVersion` a
client reports, so gate on flags that target identity.

## Semantics that are easy to get wrong

- **Off means off.** A disabled flag serves `false` (or the default variant),
  whatever its `defaultValue` — that is what lets a kill switch whose default
  is `true` go dark. The default is for "not configured" and "unreachable".
- **Rollouts bucket by organization**, falling back to the user
  (`bucketBy: 'user'` to change it), so a workspace sees one product. The hash
  is MurmurHash3 over `key.salt.unit` — stable across replicas and languages.
- **A split cannot bucket an anonymous caller**, so it serves the default.
- **Split weights are percentages in 0.01 % steps** that add up to exactly
  100: the write schema checks the integer bucket widths the evaluator walks,
  so a saved split covers every one of the 10 000 buckets.
- **`platformRole` is the Better Auth platform role** (`user`, `admin`,
  `superadmin`), not the caller's role in an organization.
- **A sticky read** holds for one key and one audience while mounted;
  signing in or out latches afresh.
- **Identity comes from the session**, never from the client. Clients report
  only `platform` and `appVersion`, which is fine for targeting and never for
  authorization.
- **A failed fetch keeps the last good answer.** `FeatureFlagsService.get()`
  rejects rather than resolving to defaults; the persisted query cache holds
  the last set across a cold start.
- **The catalog is not in the `@oppenheimer/shared` root barrel.** The API
  imports `@oppenheimer/shared/feature-flags`; the web tier reads the Zod-free
  `@oppenheimer/shared/feature-flags/catalog` (pre-bundled in
  `apps/web/vite.config.ts`) and imports types from the former.

## What is not a flag

- **Who may use a feature** is a role (`rbac-roles.md`) or a plan (the
  starter's `billing` module, not composed in the MVP). Entitlement in flags
  is an unaudited second permission system.
- **Deployment capabilities** (is S3 configured?) are `CapabilitiesService`.
- **Configuration** (limits, endpoints, timeouts) is the root `.env` and the
  API's config sections. It is untargeted and unaudited; never put a flag
  there.
- **PostHog** is analytics only. Its own flag loading is switched off.

## Changing targeting

Through the API — the console has no flags screen yet; the copy for one is in
`packages/translations/*/control.json` under `flags` — gated by
`read`/`update` on `FeatureFlag` and the `flags:read`/`flags:write` scopes.
Every change — targeting, a toggle, a segment — lands on the audit trail
(`GET /v1/feature-flags/changes`) with the actor, their comment and the
before/after. The replica that made a change applies it at once; the others
within `SNAPSHOT_POLL_INTERVAL_MS` (15 s).

A segment that a rule still targets cannot be deleted (`FLAG_006`) — the rule
would silently match nobody.
