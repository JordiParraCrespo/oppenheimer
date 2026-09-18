---
"@oppenheimer/api": minor
---

Make the API's Domain-Driven Hexagon layout a contract a machine enforces,
rather than a description a module can drift away from.

`apps/api/ARCHITECTURE.md` already described the hexagon well. Nothing checked
the *shape* of a module against it, so the shape had gone its own way: four
modules had grown a `services/` bucket, `auth/` kept persistence models in
`entities/` and its Better Auth instance in a bare `auth.ts`, five modules left
loose files at their root, and two carried 500-line services behind multi-route
controllers. Dependency-cruiser only ever policed the *direction* of imports —
a file in the wrong layer with the right imports passed.

**One shape, no empty directories.** Every module is cut the same way. A
directory appears when it has something to hold — a module with no aggregate
has no `domain/`, not an empty one — but the set of directories is closed and
each admits a fixed set of file names:

| Directory | Admits |
| --- | --- |
| `domain/` | `*.entity.ts`, `*.errors.ts`, `*.policy.ts`, `*.factory.ts`, `*.types.ts`, `value-objects/`, `events/` |
| `database/` | `*.orm-entity.ts`, `*.repository.port.ts`, `*.repository.ts` |
| `infrastructure/` | `*.port.ts`, `*.adapter.ts`, `*.gateway.ts`, `*.processor.ts`, `*.config.ts`, `*.util.ts`, `*.types.ts` |
| `commands/<use-case>/`, `queries/<use-case>/` | the message, its handler, the controller, the request DTO |
| `application/` | `*.factory.ts`, `*.policy.ts`, `*.resolver.ts`, `*.port.ts`, `event-handlers/` |
| `dtos/`, `guards/`, `decorators/`, `interceptors/` | the one kind each is named for |
| `probes/` | `*.probe.controller.ts`, `*.indicator.ts` |

The command handler is `<use-case>.command-handler.ts`, matching
`<use-case>.query-handler.ts`. It used to be `<use-case>.service.ts`, which was
the dissolved bucket surviving as a suffix — the contract cannot forbid a
`services/` directory and then require every handler to be named after one.

A **probe is not a use case.** `/health`, `/ready` and `/health/capabilities`
report on the process, have no command or query behind them and never will, so
they have a shape of their own rather than owing three slices they would leave
empty.

The module root carries only `<module>.module.ts`, `*.mapper.ts`,
`*.di-tokens.ts` and `*.resource.ts`.

**There is no `services/`.** That is the change with the most reach, because a
"service" is not a layer and a directory named after one is where a module goes
to stop being a hexagon. Every one of them was dissolved into the thing it
actually was: `roles/services/ability.factory.ts` and `role-grant.policy.ts`
became `roles/application/`, the authz and profile resolvers became
`application/` too, and what really talked to something outside the process
became an adapter — `profile/services/avatar.storage.ts` →
`profile/infrastructure/avatar-storage.adapter.ts`,
`profile-auth.facade.ts` → `profile-auth.gateway.ts`,
`auth/services/delegated-session.service.ts` →
`auth/infrastructure/delegated-session.adapter.ts`.

The same question was put to every other file that had no layer in its path.
`auth/entities/*.entity.ts` were TypeORM models, so they are now
`auth/database/*.orm-entity.ts`; `auth/auth.ts` is
`auth/infrastructure/better-auth.config.ts`; `queue/email.processor.ts`,
`throttling/redis-throttler.storage.ts`, `health/redis-health.indicator.ts` and
`outbox/outbox-relay.service.ts` moved into their modules' `infrastructure/`;
`users/user-access.ts` became `users/application/user-access.policy.ts`;
`api-tokens/domain/ip-allowlist.ts` and `api-token.secret.ts` became a
`*.policy.ts` and a `*.factory.ts`. `auth/scope-context.ts` was sitting in
`domain/` while importing `express`, which is exactly the impurity the domain
rule exists to catch — it kept its place once the express dependency went (see
below). Specs were renamed to follow their subjects. Every relative import, the
TypeORM datasource, the seed and each `vi.mock()` path moved with them.

**`scripts/check-api-structure.mjs`** (`pnpm check:api-structure`) is that table,
executable. Beyond the directory and file-name sets it holds four rules that
decay first: a use case is a directory and every file in it carries its name; a
message and its handler come as a pair; an HTTP route is declared in a use-case
controller and nowhere else; and a controller is capped at 110 lines, a handler
at 120. Each dissolved bucket name reports the question to ask instead of the
bucket.

**`.dependency-cruiser.cjs`** gains five rules alongside the existing ones: a
controller goes through the bus and never reaches into `database/` at runtime;
TypeORM stays in `database/` and `infrastructure/`; Better Auth is an external
system reached through an adapter; a use-case slice does not import another
slice's internals; and a module publishes only its domain, DTOs, ports, DI
tokens, bus messages and inbound adapters — its handlers, mappers and concrete
adapters are its own. `handlers-depend-on-port-not-adapter` now covers
`*.adapter.ts` and `*.gateway.ts`, not just `*.repository.ts`.

**Every adapter has a port.** Six of them — `AvatarStoragePort`,
`ProfileAuthPort`, `LocaleResolverPort`, `DelegatedSessionPort`,
`CredentialScopePort` and `CredentialVerifierPort` — each with a DI token the
composition root binds. Handlers and guards inject the token and name the port;
`profile.module.ts` and `auth.module.ts` export tokens, never classes. Moving a
file into `infrastructure/` is not what makes it an adapter, and a checker
taught to look away is not a ledger.

That last port is what gives `better-auth-stays-behind-an-adapter` its teeth.
The rule matched `node_modules/better-auth`, which nothing imports directly —
everything imports `auth` from `better-auth.config.ts`, so the rule was
vacuously true. It now covers the configured instance, and
`CredentialScopeResolver` asks a `CredentialVerifierPort` instead of calling
`auth.api.getMcpSession` from the application layer.

`ScopedRequest` no longer extends express's `Request`. That import was the only
reason it sat in `infrastructure/`, and it forced six use-case controllers to
depend on an adapter layer — which is what had made a
`^src/auth/infrastructure/` wildcard on the cross-module surface look
necessary. It is structural and node-core only, back in `domain/`, and the
wildcard is gone.

**Known violations are a ledger, not an exemption.** `admin/` and
`organizations/` are the pre-contract Better Auth façades — a root-level service
and multi-route controllers across 42 routes. Rather than weaken the checks for
them, each outstanding violation is listed as a `(path, kind)` pair: the prose
is output, never identity, so rewording a message can neither silence a
violation nor invent a stale one. Nothing else in those modules is excused, a
new violation in them still fails, and an entry that stops matching is itself an
error. `apps/api/AGENTS.md` says what to do when you touch them: a new operation
goes in as a slice, never onto the old service.

**The checker has its own test suite.** `scripts/check-api-structure.test.mjs`
builds trees for the purpose and pins the `kind` each breach reports, including
two fixtures over the ledger mechanism itself. Running a checker only over the
repository says whether the repository conforms today; it cannot exercise a rule
nothing currently breaks.

Not owning the data turns out to be a reason to have a port, not a reason to
skip the contract, and the docs now say so. `ARCHITECTURE.md`'s "what is
intentionally NOT full DDD" section is replaced by "modules that own no
aggregate", which describes the port-plus-gateway-plus-slices shape those
façades are migrating to.

The contract table lives in **one** place. `.agents/rules/nestjs-architecture.md`
and the `/scaffold-module` skill point at `ARCHITECTURE.md` and keep only what
is local to them, and `apps/docs/docs/architecture/api-architecture.md` — which
still described `auth/auth.ts`, `users/services/`, a three-layer mapper and an
event bus with no outbox — was rewritten against it. CI runs `pnpm check:api-structure` in the
lint job and the Claude Code Stop hook runs it whenever a task touches
`apps/api/src`.
