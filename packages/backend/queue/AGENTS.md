# @oppenheimer/backend-queue — Agent Instructions

BullMQ job queues plus a Bull Board dashboard for the NestJS API.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── bull-board.setup.ts   # Bull Board admin UI wiring
└── index.ts
```

## Conventions

- Queue names are defined centrally as `QUEUE_NAMES` in `@oppenheimer/shared` — use
  them, don't hardcode strings.
- Queue registration, job options, producers and consumers live in `apps/api`:
  every queue is registered once, in `src/queue/queue.module.ts`, with its
  options from `src/queue/infrastructure/queue-options.config.ts`. This
  package provides the dashboard only.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-queue build
pnpm --filter @oppenheimer/backend-queue dev
```
