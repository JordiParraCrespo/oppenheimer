---
paths:
  - "apps/api/**/*"
---

# API Configuration Rules

## One `.env`, at the root of the repo

There is **one `.env`, at the workspace root**, and the root `.env.example` is
its documentation. Never add a per-package `.env` or `.env.example`.

- If you add a variable, add it to the root `.env.example` with a note on what
  it does. The inverse rule keeps the file honest: every variable the repo
  reads is in it, and nothing that is not read is in it.
- Loading goes through `@oppenheimer/env` (`packages/env`): it finds the workspace
  root, loads `.env` then `.env.local` (local wins between the files), and
  **never overwrites a value already in `process.env`** — real environment
  variables always win, so the same code is correct in CI and in production
  containers. `vercel env pull` writes `.env.local`, which therefore silently
  overrides `.env`.
- Entry points load it as their first import: `import '@oppenheimer/env/load';`
  (`main.ts`, `config/data-source.ts`, `database/seed.ts`,
  `generate-openapi.ts`, `auth/auth.ts`). Do not import `dotenv/config` —
  it resolves `.env` against `process.cwd()`, which is exactly the fragility
  `@oppenheimer/env` replaces.
- `apps/web` does not use the loader: `vite.config.ts` points `envDir` at the
  workspace root. `apps/mobile` calls `loadEnv()` in `app.config.ts` so Metro
  inlines `EXPO_PUBLIC_*` values from the root file.

## Optional capabilities: a missing key removes a feature, it never throws

Anything a self-hoster might not have — OAuth credentials, Stripe, S3,
SMTP/Resend — is **optional capability config**, and the code must work
without it. Model absence honestly:

- Optional keys are genuinely optional in the Zod schema
  (`z.string().optional()`). **Never** a sentinel default like
  `.default('not-set')` or `|| 'disabled'` — a sentinel is a string pretending
  to be an absence: nothing type-checks that consumers know the magic value,
  and a consumer that doesn't check hands it to a real service, surfacing as
  an opaque provider-side error instead of "this feature isn't configured".
  With `.optional()`, absence is `undefined` and the compiler forces the
  check.
- Normalize blank env vars (`FOO=`) to `undefined` before validation with the
  `orUndefined` helper in `config/env.ts`, so `.url().optional()` and friends
  still boot. It uses whitespace to decide **blankness only** and never trims
  the value it returns — a credential may legitimately be padded, and a config
  that quietly rewrote `DB_PASSWORD` would disagree with Better Auth's pool,
  which reads `process.env` directly. Do not add a trim here or at a call site.
- Declare the feature in `resolveCapabilities()`
  (`src/capabilities/capabilities.module.ts`). The resolved set — currently
  `google_oauth`, `github_oauth`, `stripe_billing`, `s3_storage`,
  `email_delivery` — is computed once at boot and logged at startup, so a
  self-hoster learns what the deployment can do from the log. Only the
  **client-facing subset** (`CLIENT_CAPABILITIES` in `@oppenheimer/shared`:
  the OAuth providers and `stripe_billing`) is served by
  `GET /health/capabilities`, so clients can hide UI for capabilities that are
  off (the web login page only renders configured providers). Server-internal
  capabilities (`s3_storage`, `email_delivery`) never go over the wire — a
  public endpoint must not describe a deployment's infrastructure beyond what
  its UI already reveals. Add a capability to `CLIENT_CAPABILITIES` only when
  a client has a UI decision hanging on it.
- Feature code that would need a missing key fails fast with a clear domain
  error ("Billing is not configured on this server"), the way
  `StripePaymentGateway` does — never by passing a placeholder downstream.

```typescript
// WRONG — crashes at boot if env var is empty
clientID: configService.getOrThrow<string>('oauth.google.clientId'),

// WRONG — boots, but leaks a fake credential to every consumer
clientId: z.string().default('not-set'),

// CORRECT — absence is representable; consumers must handle undefined
clientId: z.string().optional(),
```

### Required vs optional — keep the boundary explicit

Not every variable gets the capability treatment, and conflating the two is
how a deployment boots into a broken state. Settings the app cannot function
without (database credentials, `BETTER_AUTH_SECRET`) are **required**: validate
strictly (`z.string().min(8)`) and fail fast and loud at boot, as
`app.config.ts` does. The capability pattern is only for keys whose absence
removes a feature rather than breaking the app. Say which one a key is in a
comment in the config file.

## Reading config in services — private getters, not inline lookups

Don't scatter `configService.get(...)` calls and their `?? default` ternaries
through a handler's `execute()`. Wrap each config-derived value in a named
`private get` accessor and let `execute()` read the intent, not the plumbing.
This keeps the method readable and the fallbacks in one place.

```typescript
// WRONG — inline lookups + nested ternaries in the use case
async execute(command: CreateCheckoutCommand): Promise<string> {
  const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? '';
  const successUrl =
    command.successUrl ??
    this.configService.get<string>('stripe.successUrl') ??
    `${frontendUrl}/billing?status=success`;
  // ...
}

// CORRECT — the use case reads `command.x ?? this.defaultX`
async execute(command: CreateCheckoutCommand): Promise<string> {
  return this.gateway.createCheckoutSession({
    successUrl: command.successUrl ?? this.defaultSuccessUrl,
    // ...
  });
}

private get frontendUrl(): string {
  return this.configService.get<string>('app.frontendUrl') ?? '';
}

private get defaultSuccessUrl(): string {
  return (
    this.configService.get<string>('stripe.successUrl') ??
    `${this.frontendUrl}/billing?status=success`
  );
}
```

Config files (`config/*.config.ts`) still own env parsing/validation via Zod;
normalize blank env vars (`FOO=`) to `undefined` before validation so
`.url().optional()` and friends still boot (e.g. an `orUndefined` helper).

## Controllers

Endpoints live in per-use-case `*.http.controller.ts` files inside their
`commands/` or `queries/` slice (see `nestjs-architecture.md`). Controllers only
dispatch through the `CommandBus` / `QueryBus` and map results — no business
logic. Multiple controllers share a `@Controller('<resource>')` path; order them
in the module's `controllers` array so static routes (e.g. `me`) are registered
before parameterized ones (e.g. `:id`).

## Swagger decorators required

All API endpoints need `@ApiOperation`, `@ApiResponse`, and `@ApiTags` decorators for the auto-generated client (`pnpm generate:api-client`).

## Validation

- Request DTOs use Zod schemas from `packages/shared`
- All user input is sanitized via `SanitizePipe` (strips HTML) and validated via `ZodValidationPipe`

## Rate limiting

Apply `@Throttle()` on public-facing endpoints:

| Endpoint        | Limit  |
| --------------- | ------ |
| Register        | 5/min  |
| Login           | 10/min |
| Forgot password | 3/min  |

The `/api/auth/*` routes never reach the NestJS `ThrottlerGuard` (Better Auth
mounts them on the HTTP adapter first), so their limits live in Better Auth's
own `rateLimit` block in `auth.ts`, stored in the `rateLimit` table so they
hold across replicas. It is on in production and opt-in elsewhere
(`AUTH_RATE_LIMIT_ENABLED`).

**The tracker is keyed on the credential, not the IP.**
`CredentialThrottlerGuard` (`src/throttling/`) is the app's `APP_GUARD`: it
buckets by `credentialId`, falling back to the user id and only then to the
IP. The default IP tracker is wrong for every machine caller — a relay forwards
many callers' traffic from one address, so an IP bucket is shared by all of
them and the per-route number describes nothing anybody intended.

**Counters live in Redis** (`RedisThrottlerStorage`), because the in-memory
default multiplies every limit by the replica count without saying so. It
increments atomically in one round trip, and **fails open** if Redis is
unreachable: a limiter must not be a second thing that can take the API down.

## Versioning

All routes use URI versioning with `@Version('1')`. The default version is `v1`.

## Logging

Request logging comes from `LoggingModule` in `@oppenheimer/backend-core`
(`nestjs-pino` with hardened defaults), imported once in `AppModule`.

- **Never log headers, query strings, or request bodies.** They routinely carry
  session cookies, bearer tokens, and personal data. The module's serializers
  drop them (and redact credential headers as a backstop) — log only the
  specific fields a handler knows are safe.
- **Structured fields, one object per line.** Nest prints one line per
  argument, so `logger.log('Saved', { userId })` emits two lines. Hoist fields
  to the top level of a single object instead:

  ```typescript
  // WRONG — two log lines; fields never attach to the message
  this.logger.log("Saved user", { userId });

  // CORRECT — one JSON line with searchable top-level fields
  this.logger.log({ message: "Saved user", userId });
  ```

- **Errors pass the stack as the second argument.** Passing the error object
  itself loses the trace:

  ```typescript
  this.logger.error(
    { message: "Subscription sync failed", subscriptionId },
    error instanceof Error ? error.stack : String(error),
  );
  ```

- **User context is automatic.** `UserContextInterceptor` attaches `userId`
  (and the credential's effective `scopes`) to the request log context once the
  auth guards resolve — never add them by hand, and never log emails or names.
- **`/api/auth/*` is logged through Better Auth's `middleware` option** on
  `BetterAuthModule.forRoot` in `AppModule`. Better Auth mounts its handler
  onto the HTTP adapter before Nest binds consumer middleware, so the main
  request logger cannot see those routes — keep that option wired.
- **SQL query logging is opt-in** via `DB_LOG_QUERIES=true`, off by default
  because it buries every other line under a wall of SELECTs. Even when
  enabled, `TypeOrmQueryLogger` drops bound parameters — they carry user data.
