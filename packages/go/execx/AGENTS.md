# @oppenheimer/go-execx — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first, then
> [`packages/go/README.md`](../README.md) for how the Go modules fit
> together and [`apps/runner/ARCHITECTURE.md`](../../../apps/runner/ARCHITECTURE.md)
> for the hexagon they serve.

## Where things go

- A run-and-collect subprocess anywhere in a Go service goes through
  `execx.Run`; a long-lived process (a PTY, a streamed output) uses `os/exec`
  directly.
- Error wording and codes belong to the caller: map `Error.TimedOut`,
  `Error.Canceled` and the output onto the caller's own catalog entry.
- Nothing here names what it runs (git, tmux, a service manager); the module
  stays domain-agnostic and imports only the standard library.

## Before pushing

```bash
pnpm --filter @oppenheimer/go-execx lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-execx test    # go test -count=1 ./...
cd packages/go/execx && GOOS=windows go build ./...   # the proc_other.go stub
pnpm --filter @oppenheimer/runner test      # the runner's boundary test still passes
```

## Patterns agents get wrong

- Setting `KillGroup` on a command that starts a daemon meant to outlive it
  (tmux's server): the group kill would take the daemon with it.
- Treating `Result.Out` as empty on failure. It holds what the command
  printed, which is usually why it failed.
- Passing `Env` with only the extra variables. A non-nil `Env` is the whole
  environment; append to `os.Environ()`.
- Adding a `Timeout` in the caller *and* in `Spec` for one budget. A budget
  shared across several calls is a caller's `context.WithTimeout` with
  `Timeout: 0`.

See [`.agents/rules/go.md`](../../../.agents/rules/go.md).
