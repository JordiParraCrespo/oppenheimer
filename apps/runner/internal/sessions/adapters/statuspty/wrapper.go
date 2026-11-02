package statuspty

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// RunOptions is one wrapped program.
type RunOptions struct {
	// Argv is the program and its arguments.
	Argv []string
	// Report is the file the program's reports are kept in, written whole on
	// every change and removed when the program ends.
	Report string
	// In and Out are the pane's terminal: keys come in on In, the program's
	// screen goes out on Out.
	In, Out *os.File
}

// Run runs the program on a terminal of its own and returns its exit code.
//
// Everything is passed through except OSC 7501: the probe is answered on
// the program's behalf, and reports are kept in the report file instead of
// reaching tmux, which would drop them anyway. Keys go to the program as
// they arrive (the pane's terminal is put in raw mode, so its own line
// discipline is the program's), the pane's size follows the program, and a
// hangup or termination of the wrapper reaches the program's process group.
func Run(ctx context.Context, opts RunOptions) (int, error) {
	if len(opts.Argv) == 0 {
		return 2, errors.New("no program to run")
	}
	cmd := exec.CommandContext(ctx, opts.Argv[0], opts.Argv[1:]...) //nolint:gosec // the agent's own command line, built by the runner
	// A cancelled wrapper hangs the agent up, as closing its terminal would,
	// rather than killing it outright: an agent saves its conversation on
	// hangup.
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGHUP) }
	size, sizeErr := pty.GetsizeFull(opts.In)
	if sizeErr != nil {
		size = &pty.Winsize{Cols: 80, Rows: 24}
	}
	ptmx, err := pty.StartWithSize(cmd, size)
	if err != nil {
		return 127, err
	}
	defer func() { _ = ptmx.Close() }()

	if restore, err := makeRaw(int(opts.In.Fd())); err == nil {
		defer restore()
	}

	signals := make(chan os.Signal, 4)
	signal.Notify(signals, syscall.SIGWINCH, syscall.SIGHUP, syscall.SIGTERM, syscall.SIGINT, syscall.SIGQUIT)
	defer signal.Stop(signals)
	go func() {
		for sig := range signals {
			if sig == syscall.SIGWINCH {
				if size, err := pty.GetsizeFull(opts.In); err == nil {
					_ = pty.Setsize(ptmx, size)
				}
				continue
			}
			if cmd.Process != nil {
				// The program leads its own session (pty.Start), so the signal
				// tmux sent the pane never reached it.
				_ = syscall.Kill(-cmd.Process.Pid, sig.(syscall.Signal))
			}
		}
	}()

	keeper := &reportKeeper{path: opts.Report}
	defer keeper.remove()
	var writes sync.Mutex
	toProgram := func(p []byte) error {
		writes.Lock()
		defer writes.Unlock()
		_, err := ptmx.Write(p)
		return err
	}
	filter := &Filter{
		OnQuery:  func() { _ = toProgram([]byte(domain.ProgramStatusReply)) },
		OnReport: keeper.apply,
	}

	go func() {
		buf := make([]byte, 32<<10)
		for {
			n, err := opts.In.Read(buf)
			if n > 0 && toProgram(buf[:n]) != nil {
				return
			}
			if err != nil {
				return
			}
		}
	}()

	buf := make([]byte, 32<<10)
	for {
		n, err := ptmx.Read(buf)
		if n > 0 {
			if out := filter.Write(buf[:n]); len(out) > 0 {
				if _, werr := opts.Out.Write(out); werr != nil {
					break
				}
			}
		}
		if err != nil {
			// EIO once the program and everything it started have closed the
			// terminal: the ordinary end.
			break
		}
	}
	if rest := filter.Flush(); len(rest) > 0 {
		_, _ = opts.Out.Write(rest)
	}
	return exitCode(cmd.Wait()), nil
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		if status, ok := exit.Sys().(syscall.WaitStatus); ok && status.Signaled() {
			return 128 + int(status.Signal())
		}
		return exit.ExitCode()
	}
	return 1
}

// reportFile is what the wrapper writes and the runner reads: the report,
// and the wrapper's pid, so a file a killed wrapper left behind is never
// taken for a live program's word.
type reportFile struct {
	Pid    int                  `json:"pid"`
	Report domain.ProgramReport `json:"report"`
}

type reportKeeper struct {
	path   string
	report domain.ProgramReport
	last   []byte
}

func (k *reportKeeper) apply(status domain.ProgramStatus) {
	k.report.Apply(status)
	if k.path == "" {
		return
	}
	body, err := json.Marshal(reportFile{Pid: os.Getpid(), Report: k.report})
	if err != nil || string(body) == string(k.last) {
		return
	}
	if writeWhole(k.path, body) == nil {
		k.last = body
	}
}

func (k *reportKeeper) remove() {
	if k.path != "" {
		_ = os.Remove(k.path)
	}
}

// writeWhole writes a file as one rename, so a reader never sees half of it.
func writeWhole(path string, body []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".report-*")
	if err != nil {
		return err
	}
	_, werr := tmp.Write(body)
	cerr := tmp.Close()
	if werr != nil || cerr != nil {
		_ = os.Remove(tmp.Name())
		return errors.Join(werr, cerr)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	return nil
}
