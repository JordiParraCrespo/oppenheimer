# apps/api — Agent Instructions

NestJS **Domain-Driven Hexagon** API. The authoritative references are
[`ARCHITECTURE.md`](./ARCHITECTURE.md) (layer model, module anatomy, the
"add a module" cookbook) and the scoped rules in `.agents/rules/`
(`nestjs-architecture.md`, `nestjs-di.md`, `typeorm.md`, `api-config.md`,
`rbac-roles.md`). Boundaries are enforced by `.dependency-cruiser.cjs`
(`pnpm --filter @oppenheimer/api arch`). This file adds the conventions that are easy
to get wrong.

## Mappers own all data-shape transformations

**Any operation that shapes, normalizes, or builds a data structure belongs in a
mapper — not inline in a service, handler, or controller.** This includes:

- Domain ↔ ORM ↔ response-DTO conversion (`Mapper<Domain, Orm, Response>`:
  `toPersistence` / `toDomain` / `toResponse`).
- Building a props object for a domain method (e.g. a `toSyncProps(data)` that
  assembles the fields for `entity.sync(props)`).
- Normalizing an external API result into a DTO (coercion, date parsing,
  unwrapping `{ member }` / `{ users }` envelopes).

Services and controllers stay thin: they orchestrate and delegate to a mapper
for the transform. Keep mappers **pure** (framework-free, no DI) so they are
trivially unit-testable and reusable.

### No `as`-cast soup — narrow once, in the mapper

Mapper functions **accept `unknown`** and narrow a single time with a small
helper, so callers pass values cast-free. Never write `x as unknown as { ... }`
double-casts or repeated `as Record<string, unknown>` at call sites.

```ts
// GOOD — mapper narrows once; the service is cast-free
export function mapMember(input: unknown): MemberResponseDto {
  const m = asRecord(input);
  return {
    id: String(m.id),
    userId: String(m.userId),
    role: String(m.role) /* ... */,
  };
}
// service:  return mapMember(unwrap(result, 'member'));

// BAD — dirty casts leaking into the service
const member =
  (result as unknown as { member?: Raw }).member ?? (result as unknown as Raw);
```

Shared shaping helpers (`asRecord`, `asArray`, `unwrap`, `unwrapArray`) live in
`src/auth/infrastructure/better-auth.util.ts`.

**One mapper per aggregate, named for it** — `subscription.mapper.ts`, not a
`*.mappers.ts` bag of loose functions. `pnpm check:api-structure` rejects the
plural name; `admin.mappers.ts` and `organization.mappers.ts` are on its ledger
precisely because they are that bag. Array and envelope mappers belong on the
aggregate's mapper beside the scalar ones, as methods.

## Delegating façades (organizations, admin)

`src/organizations/` and `src/admin/` expose the Better Auth organization/admin
plugin operations as typed, Swagger-documented, CASL-guarded REST endpoints that
**delegate to `auth.api.*`**. Better Auth owns the tables, so there is no
aggregate to write — but not owning the data is a reason to have a **port**,
not a reason to skip the module contract. The target shape, like every other
module (see [`ARCHITECTURE.md`](./ARCHITECTURE.md)), is: a port in
`infrastructure/` describing what the application needs, a gateway beside it
that speaks to `auth.api.*`, and one use-case slice per operation.

> **Both modules are mid-migration.** They still carry a root-level
> `*.service.ts` and multi-route `*.controller.ts` — the pre-contract layout.
> `pnpm check:api-structure` reports each of those files, and
> `.dependency-cruiser.cjs` carries a ledger entry for
> `organizations.service.ts`. **Do not add a route to either module in the old
> shape.** A new operation goes in as a slice; a route you touch is a chance to
> move it. Neither module is an example to copy — `users/` and `profile/` are.

Use `betterAuthHeaders` from `src/auth/infrastructure/better-auth.util.ts`,
and normalize every `auth.api` result through a mapper (see above). See
`.agents/rules/rbac-roles.md` for the full RBAC + org/admin guide.

**A rule the app owns is a slice, even inside a façade module.** The personal
workspace is the worked example: sign-up gives every account one organization
it owns, with the org-scoped `owner` role that opens it — Better Auth has no
such concept, so it is an aggregate, a repository port and a command handler
(`organizations/commands/provision-personal-workspace/`), not another
`auth.api` call. The test is whose rule it is, not which module it lands in.

**A Better Auth hook may read. It may not write a product rule.** `auth/auth.ts`
is configured at module scope — it has to be, because the handler is mounted on
the HTTP adapter before Nest builds its injector — so its `databaseHooks` can
inject nothing, and anything they do reach for is reached for directly.

A read is allowed to stay a query on Better Auth's own pool. `session.create.before`
is the standing example: it picks the organization a returning user lands in,
it has to answer before the session row is written, and getting it wrong costs
a redirect. Keep such a query in one labelled block that says what it decides.

A **write that encodes a product rule** — what an account is owed, what it may
do, what it belongs to — never goes in a hook. That is how the personal
workspace ended up as `INSERT` statements no domain object knew about. The hook
raises one command (`CompleteSignUpCommand`) through `dispatchFromAuthHook`
(`src/auth/infrastructure/auth-command-bus.util.ts`), and a handler that *can* inject decides what
that means. The hook names no module: a new side effect is a change to
`CompleteSignUpCommandHandler`, not another import here.

Dispatches from a hook are best-effort and logged — Better Auth does not await
`after` hooks, so a throw there would be an unhandled rejection rather than a
failed request. Outside the API (the seed) there is no command bus, and the
script owes itself those side effects by calling the handlers directly.

**Wrap every `auth.api.*` call in the module's own invoker** —
`invokeOrganizationApi` (`organizations/organization-error.mapper.ts`) or
`invokeAdminApi` (`admin/admin-error.mapper.ts`), both built with
`betterAuthInvoker`. Those two files sit at the module root today only because
`*.mapper.ts` is on the root allowlist; once each module is cut into slices the
error fold belongs beside its gateway in `infrastructure/`, not as a second
mapper at the root. They fold Better Auth's `APIError` onto the module's error
catalog so the response is a proper problem document with an `ORG_*`/`ADMIN_*`
code, keeping the upstream code as an `upstreamCode` extension. Throwing a bare
`HttpException` here loses the code entirely — see "Structured errors" in
`.agents/rules/nestjs-architecture.md`.

## Config

Config is composed from `registerAs` factories in `src/config/` (`app`,
`database`, `redis`, `email`, `storage`, `oauth`, `stripe`), loaded in
`AppModule` and read via `ConfigService`. Optional-credential config (OAuth,
Stripe, S3, SMTP) uses genuinely optional schema keys (`z.string().optional()`,
never a sentinel default or `getOrThrow`) so the app boots without those env
vars; each such feature is declared in `src/capabilities/capabilities.module.ts`,
logged at startup, and the client-facing subset (`CLIENT_CAPABILITIES`) is
served by `GET /health/capabilities` — see `api-config.md`. The TypeORM CLI datasource
(`src/config/data-source.ts`) and the seed (`src/database/seed.ts`) keep their
own explicit `entities` arrays: **register every new ORM entity in both**, plus
the module's `TypeOrmModule.forFeature`.

## Commands

```bash
pnpm --filter @oppenheimer/api dev                # watch mode
pnpm --filter @oppenheimer/api arch               # dependency-cruiser boundary check
pnpm --filter @oppenheimer/api test               # unit tests
pnpm --filter @oppenheimer/api test:integration   # needs Docker (Postgres + Redis)
pnpm --filter @oppenheimer/api migration:generate -- src/migrations/<Name>  # generate a migration (name/path is required)
pnpm --filter @oppenheimer/api migration:run
pnpm --filter @oppenheimer/api generate:openapi   # emit openapi.json
```
