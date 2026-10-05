# @oppenheimer/go-execx

Runs a command to completion the one way the Go services do: bounded by a
timeout, its output collected, and — once it has exited or been cancelled —
the wait for leftover output bounded, with the whole process group killed
when the caller asks for it. Every run-and-collect subprocess in
`apps/runner` goes through `Run`, so a wedged child, or a helper that inherits
the output and outlives the kill, cannot hold a call open forever.

The module imports only the standard library and knows nothing about what it
runs; each caller keeps its own error catalog and wording.

## What it exports

`execx.go`

- `Run(ctx, Spec) (Result, error)` — runs `Spec{Name, Args, Dir, Env,
  Timeout, KillGroup, WaitDelay, Output}` and returns `Result.Out`, the
  collected output with trailing newlines trimmed, **on failure too**.
- `Spec.Env` — `nil` inherits `os.Environ()`; anything else is the whole
  environment, so a caller adding variables appends to `os.Environ()` itself.
- `Spec.Output` — `Combined` (stdout and stderr interleaved, as
  `CombinedOutput`) or `Stdout` (stdout only, as `Output`; stderr still feeds
  the error's lines).
- `Spec.KillGroup` — a process group of its own, killed as a whole on cancel
  (`proc_unix.go`); a no-op where there are no process groups
  (`proc_other.go`), so the module builds everywhere. Leave it off for a
  command that starts a daemon meant to outlive it (tmux).
- `Spec.WaitDelay` — how long output is waited on after exit or kill; zero is
  `DefaultWaitDelay` (5 s).
- `Error` — `Name`, `Err` (what `os/exec` returned; `Unwrap` gives it, so
  `errors.As(err, &exitErr)` works), `TimedOut` (the context the command ran
  under hit a deadline, whether `Spec.Timeout` or one the caller's ctx
  already had), `Canceled` (the caller's ctx was cancelled), and `FirstLine` /
  `LastLine` of the collected output (of stderr in `Stdout` mode).
- `Cause(err)` — the `os/exec` error inside an `*Error`, for callers whose
  messages quote it.

## How to use it

```go
res, err := execx.Run(ctx, execx.Spec{
	Name: c.binary, Args: full, Dir: dir,
	Env:     append(os.Environ(), "GIT_TERMINAL_PROMPT=0"),
	Timeout: 60 * time.Second, KillGroup: true,
})
var failed *execx.Error
if errors.As(err, &failed) && failed.TimedOut {
	// report the timeout in the caller's own catalog
}
```

## How to run it

```bash
pnpm --filter @oppenheimer/go-execx test    # go test -count=1 ./...
pnpm --filter @oppenheimer/go-execx lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-execx build   # go build ./...
```

## Dependencies

Depends on nothing but the standard library. Imported by `apps/runner`'s
adapters; `internal/arch` keeps `app` and `domain` from importing it, so
running a process stays behind a port.
