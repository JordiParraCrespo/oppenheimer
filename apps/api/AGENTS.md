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
`src/auth/better-auth.util.ts`; array/envelope mappers (`mapMembers`,
`mapUserFromResult`, …) live alongside the scalar ones in `*.mappers.ts`.

## Delegating façades (organizations, admin)

`src/organizations/` and `src/admin/` expose the Better Auth organization/admin
plugin operations as typed, Swagger-documented, CASL-guarded REST endpoints that
**delegate to `auth.api.*`** — Better Auth owns the tables, so these are
infrastructure modules (controller → injectable service → `auth.api`), not
CQRS/domain slices. Use `betterAuthHeaders` from `src/auth/better-auth.util.ts`,
and normalize every `auth.api` result through a mapper (see above). See
`.agents/rules/rbac-roles.md` for the full RBAC + org/admin guide.

**Wrap every `auth.api.*` call in the module's own invoker** —
`invokeOrganizationApi` (`organizations/organization-error.mapper.ts`) or
`invokeAdminApi` (`admin/admin-error.mapper.ts`), both built with
`betterAuthInvoker`. They fold Better Auth's `APIError` onto the module's error
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
