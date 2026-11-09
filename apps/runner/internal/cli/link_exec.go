package cli

// `host.exec`: one program run for a bot (25 §4.2), through the host
// service, which reads this host's own policy first. Answered with
// `host.exec.result`, or `command.failed` with an EXEC_* code.

import (
	"context"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// laneExec is one lane per command id: a command runs the moment it arrives,
// never queued behind another (the host service bounds how many at once), so
// the control plane's wait for it is the run's own timeout. Only a retry of
// the same id waits behind it.
const laneExec = "exec:"

func (h *linkHandler) exec(ctx context.Context, m link.HostExec) {
	if ran, ok := h.execs.get(m.CommandID); ok {
		_ = h.client.Send(ran)
		return
	}
	result, err := h.app.Host.Exec(ctx, hostdomain.ExecRequest{
		Argv: m.Argv, Dir: m.Cwd, Home: m.Home,
		Timeout: time.Duration(m.TimeoutSeconds) * time.Second,
		Limit:   link.ExecOutputMaxBytes,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	ran := link.HostExecResult{
		Type: link.TypeHostExecResult, CommandID: m.CommandID,
		ExitCode: result.ExitCode, TimedOut: result.TimedOut,
		Stdout: result.Stdout, Stderr: result.Stderr,
		StdoutTruncated: result.StdoutTruncated, StderrTruncated: result.StderrTruncated,
		Cwd: result.Dir, DurationMs: result.Duration.Milliseconds(),
	}
	h.execs.put(m.CommandID, ran)
	_ = h.client.Send(ran)
}
