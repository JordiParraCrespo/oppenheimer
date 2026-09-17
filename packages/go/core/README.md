# @oppenheimer/go-core

The bottom of the Go toolkit: the two things every other module and every
Go service need before anything else exists. `problem` produces RFC 7807
documents that mirror the NestJS API's field for field, so one client parser
covers both stacks; `logging` builds the process-wide `slog` logger. Nothing
here knows about HTTP routing, credentials or a database; the module imports
only the standard library.

## What it exports

`problem/problem.go`

- `Error` — the one error type use cases return when they know how a failure
  should be reported; `WithDetail`, `WithCause`, `WithInvalidParams` return
  copies, so a catalog value is never mutated.
- `New(code, status, title)` declares a catalog entry; `Status(status)` is a
  bare `about:blank` problem.
- The shared catalog: `ErrValidation`, `ErrUnauthorized`, `ErrForbidden`,
  `ErrNotFound`, `ErrConflict`, `ErrPayloadSize`, `ErrInternal`
  (`RUNNER_001`–`RUNNER_006`, `RUNNER_500`).
- `Writer` renders any error as `application/problem+json` (`Write`), logging
  5xx at error and the rest at debug; `From` picks the problem for an error.
- `WithCorrelationID` / `CorrelationID` carry the request id on a context
  without importing `httpx`; `TypeFor` builds the `type` URI; `Details` and
  `InvalidParam` are the wire shapes; `ContentType`, `DefaultType`,
  `DefaultTypeBaseURL`.

`logging/logging.go`

- `New(w, Options)` — JSON or text handler at the given level, stamped with
  `service` and `version`.

## How to use it

A bounded context declares its errors once and returns them with detail; the
router renders them (from `apps/runner/internal/jobs/domain/errors.go` and
the composition root):

```go
var ErrQueueFull = problem.New("JOB_003", http.StatusTooManyRequests, "Job queue is full")

return ErrQueueFull.WithDetail("%d jobs queued", depth)
```

```go
problems := &problem.Writer{TypeBaseURL: cfg.ErrorTypeBaseURL, Logger: logger}
logger := logging.New(os.Stdout, logging.Options{Level: cfg.LogLevel, Format: cfg.LogFormat, Service: "runner", Version: cfg.Version})
```

## How to run it

```bash
pnpm --filter @oppenheimer/go-core test    # go test -count=1 ./...
pnpm --filter @oppenheimer/go-core lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-core build   # go build ./...
```

## Dependencies

Depends on nothing but the standard library. Imported by every other
`packages/go` module except `config` and `postgres`, and by every layer of
`apps/runner` (`domain` may import `core/problem` and nothing else from the
toolkit).
