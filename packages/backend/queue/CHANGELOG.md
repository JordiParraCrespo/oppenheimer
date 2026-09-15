# @oppenheimer/backend-queue

## 0.1.1

### Patch Changes

- a93cf5d: Refresh dependencies and pin the versions that must move together.

  Every package is updated within its semver range, plus a set of majors that
  carry no API change for this codebase: `@sentry/nestjs` 10, `pino-http` 11,
  `@bull-board/*` 8, `nodemailer` 9, `resend` 6, `inversify` 8,
  `dependency-cruiser` 18, `testcontainers` 12 and `@commitlint/*` 21.

  Three pins are added to `pnpm.overrides`, each for a resolution that the
  update would otherwise get wrong:

  - `react-native` — the mobile design system declares it as an unbounded
    `>=0.81.0` peer with no devDependency, so it re-resolved to 0.86 while both
    Expo apps pin 0.81.5. Two copies of React Native meant two incompatible
    copies of its types, and `@oppenheimer/design-system-mobile` stopped building.
  - `@nestjs/swagger` — 11.4.3 added an `exports` map that no longer exposes
    `dist/services/schema-object-factory`, which `nestjs-zod@4` deep-imports.
    Nothing catches this at build or test time; the API simply fails to boot.
    11.4.2 is the ceiling until the `zod` 4 / `nestjs-zod` 5 migration lands.

  Two unrelated robustness fixes in the auth layer, both found while verifying
  the upgrade against a live stack:

  - The standalone BullMQ email queue had no `error` listener. A queue is an
    EventEmitter, so a Redis restart or failover would raise an unhandled
    `error` event and take the API process down.
  - The `welcome` email enqueue in Better Auth's `user.create.after` hook was
    the only unguarded operation in a hook the surrounding code documents as
    best-effort. Better Auth does not await that hook, so a queue failure
    escaped as an unhandled rejection instead of being logged.
