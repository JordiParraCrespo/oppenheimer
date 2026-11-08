package cli

// `host.exec`: one program run for a bot (25 §4.2), through the host
// service, which reads this host's own policy first. Answered with
// `host.exec.result`, or `command.failed` with an EXEC_* code.

import (
	"context"
	"sync"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// laneExec is one lane per command id: a command runs the moment it arrives,
// never queued behind another (the host service bounds how many at once), so
// the control plane's wait for it is the run's own timeout. Only a retry of
// the same id waits behind it.
const laneExec = "exec:"

// execsRemembered is how many finished runs a runner answers again by
// their command id.
const execsRemembered = 256

// execMemo is the results of the latest runs, by command id. The control
// plane sends the same id again when it retries one approved call (a worker
// that crashed after the host ran it), and that id is answered from here
// instead of running the program a second time. A retry that arrives while
// the run is going waits behind it on the same lane, then finds it here.
// The zero value is ready to use.
type execMemo struct {
	mu    sync.Mutex
	runs  map[string]link.HostExecResult
	order []string
}

func (m *execMemo) get(commandID string) (link.HostExecResult, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.runs[commandID]
	return r, ok
}

func (m *execMemo) put(r link.HostExecResult) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.runs == nil {
		m.runs = map[string]link.HostExecResult{}
	}
	if _, ok := m.runs[r.CommandID]; ok {
		return
	}
	m.runs[r.CommandID] = r
	m.order = append(m.order, r.CommandID)
	if len(m.order) > execsRemembered {
		delete(m.runs, m.order[0])
		m.order = m.order[1:]
	}
}

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
	h.execs.put(ran)
	_ = h.client.Send(ran)
}
