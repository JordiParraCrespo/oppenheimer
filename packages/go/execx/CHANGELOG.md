# @oppenheimer/go-execx

## 0.3.0

### Minor Changes

- 9ccced3: A bot can run one program on a paired host. `run_command` is a new tool
  that asks first under Approve for me. It sends `host.exec` over the runner
  link and reads back `host.exec.result`: the exit code, and stdout and
  stderr kept to their last 32 KB each. The new `host.exec` capability gates
  it. The program runs from argv with no shell, in the bot's own folder under
  the host's workspaces (`bots/<bot id>`), for at most 120 s.

  The host decides what may run. `runner exec mode off|allowlist|full` and
  `runner exec allow|deny <program>` write `~/.oppenheimer/exec.json`. The
  runner reads that file on every call, refuses it if another account can
  write it, and starts with the mode off. A refused call is `command.failed`
  with `EXEC_001` to `EXEC_005`.

  `execx.Spec` gains `Output: Separate`, which keeps stdout and stderr apart,
  and `Limit`, which keeps only the last bytes of each stream.

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
