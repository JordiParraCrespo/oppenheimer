# @oppenheimer/backend-queue

Background job processing for the API using [BullMQ](https://docs.bullmq.io/)
(`@nestjs/bullmq`), plus a [Bull Board](https://github.com/felixmosh/bull-board)
dashboard for inspecting queues.

## What's inside

- `setupBullBoard` — mounts the Bull Board UI on the Express instance, for the
  queues named (from `QUEUE_NAMES` in `@oppenheimer/shared`), behind Basic auth.

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
