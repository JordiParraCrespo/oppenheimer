# @oppenheimer/backend-queue

Background job processing for the API using [BullMQ](https://docs.bullmq.io/)
(`@nestjs/bullmq`), plus a [Bull Board](https://github.com/felixmosh/bull-board)
dashboard for inspecting queues.

## What's inside

- `setupBullBoard` — mounts the Bull Board UI on the Express instance, for the
  queues named (from `QUEUE_NAMES` in `@oppenheimer/shared`), behind Basic auth.
  It is not mounted without credentials, nor with a password shorter than
  `BULL_BOARD_MIN_PASSWORD_LENGTH` (16). Failed sign-ins are limited per client
  address (`maxFailures`, default 10, per `failureWindowMs`, default 15
  minutes): past the limit the address gets `429` with `Retry-After` and its
  credentials are not checked. The limiter is in memory, per process, and
  capped (`maxTrackedClients`, default 10 000).

The dashboard is meant for internal access. It is raw Express middleware, so
the API's guards and throttler never see it: bind `/admin/queues` behind the
ingress to an allowlist or a VPN rather than relying on Basic auth alone.

The BullMQ connection and the queues themselves are registered in `apps/api`
(`BullModule.forRootAsync` in `app.module.ts`, each queue once in
`src/queue/queue.module.ts`).

## Usage

```ts
// main.ts — mount the dashboard
import { setupBullBoard } from "@oppenheimer/backend-queue";
import { QUEUE_NAMES } from "@oppenheimer/shared";

setupBullBoard(app, [QUEUE_NAMES.EMAIL, QUEUE_NAMES.INBOUND_EVENTS], {
  auth: { username, password },
});
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`.
