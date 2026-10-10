# @oppenheimer/backend-queue

## 0.2.0

### Minor Changes

- d79d831: Bull Board sign-in is limited and refuses weak passwords.

  - After `maxFailures` (default 10) failed Basic sign-ins from one client
    address within `failureWindowMs` (default 15 minutes), the dashboard answers
    `429` with `Retry-After` and does not check the credentials. The limiter is
    in memory, per process, and bounded (`maxTrackedClients`, default 10 000).
  - `setupBullBoard` returns `false` and mounts nothing when the password is
    shorter than `BULL_BOARD_MIN_PASSWORD_LENGTH` (16), which is now exported.

- 9ffae03: BullMQ jobs no longer stay in Redis for ever: every queue removes completed jobs after an hour (at most 1,000) and failed ones after a week, and the durable queues keep their 24-hour window. Emails are retried five times with exponential backoff instead of failing on the first provider error. Each queue is registered once, in the API's `QueueModule`, so every producer gets the same options. The unused `file-processing` queue (`QUEUE_NAMES.FILE_PROCESSING`) and the unused `QueueModule` export of `@oppenheimer/backend-queue` are removed; the package now exports `setupBullBoard` only.

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
