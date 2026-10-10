# @oppenheimer/go-execx

## 0.2.0

### Minor Changes

- da32bb1: One exec helper and one WebSocket writer pump for the Go services.

  - `@oppenheimer/go-execx` (new): `execx.Run(ctx, Spec{Name, Args, Dir, Env,
Timeout, KillGroup, WaitDelay, Output})` runs a command to completion,
    returns its output on failure too, reports `TimedOut` / `Canceled`, kills
    the process group on cancel when asked, and bounds the wait for output a
    child left open (`DefaultWaitDelay`, 5 s).
  - `@oppenheimer/go-ws`: `Pump` / `PumpChan` are the one writer for a socket,
    with pings between frames on a busy one; the hub's connections use
    `PumpChan`. Validation replies use `problem.ErrValidation.Code` rather than
    a copy of `RUNNER_001` (same value on the wire).
  - `@oppenheimer/runner`: tmux, git, systemd, launchd, the host probes and the
    staged binary's selfcheck run through `execx` with unchanged timeouts,
    output and error text; every one of them now stops waiting for output a
    leftover child holds open. The control-plane link writes through `ws.Pump`.
