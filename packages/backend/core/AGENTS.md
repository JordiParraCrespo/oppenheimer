# @oppenheimer/backend-core — Agent Instructions

Shared NestJS backend primitives: errors, exception filters, pipes,
interceptors, request helpers, and base services. Consumed by `apps/api` and
other backend packages.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first, and the backend rules
> in [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── errors/         # error types + the RFC 7807 problem-document contract
├── filters/        # NestJS exception filters
├── decorators/     # Swagger decorators (ApiProblemResponse)
├── dtos/           # Swagger models (ProblemDetailsDto)
├── interceptors/   # response/logging interceptors
├── logging/        # hardened nestjs-pino setup (LoggingModule + helpers)
├── pipes/          # validation & transform pipes
├── requests/       # request-scoped helpers
├── services/       # shared base services
├── interfaces/     # shared interfaces
└── index.ts        # public surface
```

## Conventions

- Ships **CommonJS** (see `backend-packages.md`). Keep exports CJS-compatible.
- This is a **library** package (imported directly), not a pluggable service.
- Only export from `index.ts`; keep internal modules out of the public surface.
- **Errors are RFC 7807 problem documents.** `AllExceptionsFilter` renders every
  exception as `application/problem+json`; the wire type lives in
  `@oppenheimer/shared` (`ProblemDetails`) so clients share it. An error's catalog
  message is the stable problem `title` — per-request specifics belong in
  `AppError`'s `detail`/`extensions`, never interpolated into the message. When
  adding an error code, add a row to `apps/docs/docs/errors.md`: problem `type`
  URIs are anchors on that page.

## Commands

```bash
pnpm --filter @oppenheimer/backend-core build
pnpm --filter @oppenheimer/backend-core dev    # watch
```
