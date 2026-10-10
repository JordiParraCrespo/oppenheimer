# @oppenheimer/backend-core

Cross-cutting NestJS primitives for the API: error model, exception filter,
the sanitization pipe, request-context plumbing, and paginated response
helpers. Depends on `@oppenheimer/backend-ddd`.

See `.agents/rules/nestjs-architecture.md` and `api-config.md` for how these are
wired into the API.

## What's inside

| Export                                                    | Purpose                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `AppError`, `ErrorDefinition`                             | Catalog error: code, stable title, per-occurrence detail                |
| `requireFound`                                            | The value in an `Option` lookup, or the catalog error when it is empty  |
| `AllExceptionsFilter`                                     | Global filter rendering every exception as an RFC 7807 problem document |
| `ProblemDetails`, `buildProblemDetails`, `problemTypeFor` | The problem-document contract and its builders                          |
| `ProblemDetailsDto`, `ApiProblemResponse`                 | Swagger model + decorator for documenting failures                      |
| `SanitizePipe`                                            | Input sanitization pipe                                                 |
| `RequestContextMiddleware`                                | Opens the per-request correlation id before guards run (backend-ddd's `RequestContextService`) |
| `resolveCorrelationId`, `CORRELATION_HEADER`              | The validated `x-correlation-id` (≤64 of `[A-Za-z0-9._:-]`) or a fresh UUID |
| `LoggingModule`, `buildPinoHttpOptions`                   | Hardened request logging (`nestjs-pino`): no headers/query/bodies       |
| `UserContextInterceptor`                                  | Attaches `userId` + credential scopes to the request log context        |
| `createAuthRouteLoggingMiddleware`                        | Request logging for Better Auth routes (its `middleware` option)        |
| `toPageMeta`, `PageMeta`                                  | A paginated response's `meta` from a repository's `Paginated` result    |
| `PaginatedResponseDto(Item, Meta)`                        | Base class for a paginated response DTO's `data` / `meta`               |
| `likeContains`                                            | An `ILIKE` contains-pattern with the term's `%`, `_` and `\` escaped     |
| `requestMemo`                                             | One in-flight computation per key per request, shared by every caller   |
| `MetricsModule.forRoot`, `METRICS_REGISTRY`               | The application's own Prometheus registry (global), with process metrics |
| `createMetricsProvider`, `InjectMetric`, `ModuleMetrics`  | Declare a module's counters, gauges and histograms; inject them by name |
| `HttpMetricsModule.register`, `httpMetricRoute`           | `http_requests_total` / `http_request_duration_seconds` by route group  |
| `MILLISECOND_LATENCY_BUCKETS`, `HTTP_LATENCY_BUCKETS_SECONDS` | Histogram bounds that do not clip a backoff or a slow response      |

## Usage

```ts
import { AppError, requireFound, toPageMeta } from "@oppenheimer/backend-core";

// The catalog message titles the problem type; `detail` describes this request.
throw new AppError(UserErrors.NOT_FOUND, { detail: `No user with id ${id}` });

// The same error for an empty lookup, in one line.
const user = requireFound(await repo.findOneById(id), UserErrors.NOT_FOUND, {
  detail: `No user with id ${id}`,
});

// A list response's meta from the repository's page.
return { data: page.data.map(toResponse), meta: toPageMeta(page) };
```

Metrics are declared next to what they measure and registered on the one
registry `MetricsModule.forRoot` binds:

```ts
const QueueMetrics: ModuleMetrics = {
  queue_jobs: { type: "gauge", help: "Jobs by queue and state", labelNames: ["queue", "state"] },
};

@Module({ providers: [...createMetricsProvider(QueueMetrics), QueueDepthSampler] })
export class QueueModule {}

// in the sampler
constructor(@InjectMetric("queue_jobs") private readonly jobs: Gauge) {}
```

Labels are closed sets. `HttpMetricsModule` labels a request by the **route
template** the router matched, mapped to a group by a policy the application
owns (at most 100 rules and 20 groups, or `register` throws), never by its URL;
everything unmatched is `other`. Every group and status class is created at
zero, a guard's refusal is counted, a connection the client dropped is
`aborted` and not timed, and each response is recorded once.

Responses look like this (see the [error reference](https://oppenheimer.dev/errors)):

```json
{
  "type": "https://oppenheimer.dev/errors#user_001",
  "title": "User not found",
  "status": 404,
  "detail": "No user with id 3f1c…",
  "instance": "/api/v1/users/3f1c…",
  "code": "USER_001",
  "correlationId": "2b4f…",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`, other `@oppenheimer/backend-*` packages.
