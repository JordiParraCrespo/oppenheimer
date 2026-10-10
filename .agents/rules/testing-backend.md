---
paths:
  - "apps/api/**/__tests__/**"
  - "apps/api/**/*.spec.ts"
  - "apps/api/vitest*.ts"
  - "packages/backend/**/__tests__/**"
  - "packages/backend/**/*.spec.ts"
---

# Backend Testing Rules

The API and the backend packages test with **Vitest**. A test earns its place
by protecting a behavior, a credible regression or a contract, at the boundary
that owns it; the bar, the junk patterns and the retention rules are
[`test-audit`](../skills/test-audit/SKILL.md). Read its value bar before
adding a test, not only before deleting one. Go tests are `go.md`.

## Where a spec lives

Specs sit beside what they test, in a `__tests__/` directory:

```text
apps/api/src/<module>/
├── __tests__/
│   ├── <aggregate>.entity.spec.ts          # domain
│   ├── <name>.policy.spec.ts               # domain policy
│   └── <module>.integration.spec.ts        # real Postgres/Redis
├── commands/<use-case>/__tests__/<use-case>.command-handler.spec.ts
└── queries/<use-case>/__tests__/<use-case>.query-handler.spec.ts
apps/api/src/__tests__/                     # spans modules: meta specs, schema, correlation ids
packages/backend/<pkg>/src/**/__tests__/*.spec.ts
```

- A unit spec is `<name>.spec.ts`; an integration spec is
  `<name>.integration.spec.ts`. The suffix is what separates them:
  `apps/api/vitest.config.ts` excludes `*.integration.spec.ts`, so
  `pnpm test` never needs Docker, and `vitest.integration.config.ts` runs only
  them.
- `apps/api` runs with `globals: true` and the SWC plugin, which emits the
  decorator metadata Nest's constructor injection needs; packages import
  `describe`/`it`/`vi` from `vitest`.
- Every spec file opens with a doc comment saying what it proves and, when it
  matters, which other tier covers the rest.

## Tiers

The hexagon exists to make each tier cheap. Put a test in the cheapest tier
that can see the failure.

**Domain specs** are pure: no container, no database, no mocks. They cover
every legal and illegal transition of an aggregate, every value-object
invariant at its edges, and the whole decision table of a policy. Time is
**injected** (the domain method takes `now`), so a domain spec needs no fake
timers. Fake timers are for code that schedules (`setInterval`, a lease
heartbeat), not for code that reads the clock.

**Handler specs** construct the handler with `new`, over doubles of its
**ports**, never `Test.createTestingModule`. Type each double by the port.
A `Pick<Port, 'findOneById' | 'save'>` literal is the strong form: a handler
that starts calling another method fails to compile. `as unknown as Port` is
the shortcut much of the codebase uses, and it hides exactly that. Never
`{} as Port` for a dependency the path exercises.

**Adapter specs** are rare, because the integration suite is the adapter's
owner. When one fakes `manager.query`, it returns the **driver's** shape for
that statement (`[rows, affected]` for an `UPDATE`/`DELETE`), or it certifies
the bug (`typeorm.md`).

**Integration specs** run the adapter, or the module, against real
infrastructure started by **testcontainers** (`postgres:16-alpine`,
`redis:7-alpine`):

- the schema is built by `runAllMigrations()` (`src/__tests__/run-migrations.ts`),
  never `synchronize`, so a broken migration fails here and not in production;
- prefer a bare `DataSource` over the entities under test, with a real
  `OutboxService`, to booting the application: the app adds Redis and Better
  Auth to what can make the suite red. Boot the app only when the wiring is
  the subject (`correlation-id.integration.spec.ts`);
- a repository that writes SQL of its own owes one, and a new module's
  repository gets one with it: the constraints, the conditional writes and the
  races (two writers, one wins), what a unit double can only claim;
- Docker is required. Where it is unavailable, say the suite did not run;
  never call a change verified on unit tests alone when it touched SQL.

**Seam specs** run a real chain where a bug hides between two pieces that are
each correct: a catalog error through the real `AllExceptionsFilter`, a guard
in front of a real controller. Add one when a defect would be invisible to the
specs on either side.

**Meta specs** (`src/__tests__/`: `error-catalog-coverage`,
`route-policy-coverage`, `migration-timestamps`, …) read source and docs
rather than running it, and turn a forgotten follow-up step into a red build.
Each one asserts first that it found something to check, so a stale pattern
cannot pass by matching nothing.

`Test.createTestingModule` belongs to specs whose subject is the module wiring
(a registration spec such as `queue-registration.spec.ts`), and to the
integration tier.

## Assertions

- **Assert errors by catalog code**:
  `rejects.toMatchObject({ code: 'SESSIONS_010' })`, never by class or
  message. The code is the contract; the message is not.
- **Assert the negative half.** A refusal also asserts that nothing was
  written, staged or dispatched (`expect(sessions.save).not.toHaveBeenCalled()`).
- **A conditional write is tested from both sides**: the winner applies and
  stages its events, the loser answers that it lost and stages nothing.
- Builders are local to the spec and derived from production types
  (`Partial<Parameters<typeof WorkSessionEntity.request>[0]>`), so a signature
  change breaks them at compile time. No shared mock bags.
- Test names are sentences about behavior ("refuses a second repository with
  SESSIONS_010 and writes nothing"), not method names.
- No test-only production seams: an export, flag or constructor parameter that
  exists only so a test can reach in is a design problem to fix in the owner.
