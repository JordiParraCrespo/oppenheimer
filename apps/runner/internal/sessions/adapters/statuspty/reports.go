package statuspty

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"syscall"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.ProgramStatus = (*Reports)(nil)

// maxReportFile bounds what is read of a report file.
const maxReportFile = 256 << 10

// sessionFileName is what a session id must look like to name a file: the
// ids are the control plane's UUIDs or the CLI's own, never a path.
var sessionFileName = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

// Options configures the runner's side of the wrapper.
type Options struct {
	// Executable is this runner binary, which `pty` is a subcommand of.
	Executable string
	// Dir holds one report file per wrapped session.
	Dir string
}

// Reports is the session service's view of the wrapper: the words that put
// a session's agent under it, and what the agent has reported since.
type Reports struct{ opts Options }

// New builds it.
func New(opts Options) *Reports { return &Reports{opts: opts} }

// Wrap is the command a session's agent runs under: `runner pty --report
// <file> --` followed by the agent's own command line. None when the runner
// cannot name itself or the id cannot name a file.
func (r *Reports) Wrap(sessionID string) []string {
	path, ok := r.path(sessionID)
	if !ok || r.opts.Executable == "" {
		return nil
	}
	return []string{r.opts.Executable, "pty", "--report", path, "--"}
}

// Read returns what the session's agent last reported, when its wrapper is
// still running. A file left by a wrapper that is gone — killed with its
// pane, or a runner from before a reboot — is not anyone's word.
func (r *Reports) Read(sessionID string) (domain.ProgramReport, bool) {
	path, ok := r.path(sessionID)
	if !ok {
		return domain.ProgramReport{}, false
	}
	f, err := os.Open(path) //nolint:gosec // a name checked against sessionFileName, in the runner's own state directory
	if err != nil {
		return domain.ProgramReport{}, false
	}
	defer func() { _ = f.Close() }()
	var file reportFile
	if json.NewDecoder(io.LimitReader(f, maxReportFile)).Decode(&file) != nil || !alive(file.Pid) {
		return domain.ProgramReport{}, false
	}
	return file.Report, file.Report.Reported
}

// Forget removes a session's report file, for a session that ended.
func (r *Reports) Forget(sessionID string) {
	if path, ok := r.path(sessionID); ok {
		_ = os.Remove(path)
	}
}

func (r *Reports) path(sessionID string) (string, bool) {
	if r.opts.Dir == "" || !sessionFileName.MatchString(sessionID) {
		return "", false
	}
	return filepath.Join(r.opts.Dir, sessionID+".json"), true
}

func alive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}
