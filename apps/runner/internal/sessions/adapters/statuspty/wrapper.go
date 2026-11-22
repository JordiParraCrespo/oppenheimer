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
	"time"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// DefaultGrace is how long a hung-up program is given to save its
// conversation and exit before its process group is killed.
const DefaultGrace = 10 * time.Second

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
	// Grace is how long the program has between the hangup and the kill;
	// zero is DefaultGrace.
	Grace time.Duration
}

// Run runs the program on a terminal of its own and returns its exit code.
//
// Everything is passed through except OSC 7501: the probe is answered on
// the program's behalf, and reports are kept in the report file instead of
// reaching tmux, which would drop them anyway. Keys go to the program as
// they arrive (the pane's terminal is put in raw mode, so its own line
// discipline is the program's), the pane's size follows the program, and a
// hangup or termination of the wrapper reaches the program's process group.
//
// The program ends when the wrapper is told to end (a hangup, a
// termination, ctx) or its pane goes away: it is hung up first, because an
// agent saves its conversation on hangup, and its whole process group is
// killed once the grace period is over, or at once on a second termination.
// An agent that ignores the hangup therefore never outlives its pane.
func Run(ctx context.Context, opts RunOptions) (int, error) {
	if len(opts.Argv) == 0 {
		return 2, errors.New("no program to run")
	}
	grace := opts.Grace
	if grace <= 0 {
		grace = DefaultGrace
	}
	// Taken before the program starts: a hangup in between would end the
	// wrapper by default and leave the program, in a session of its own,
	// running.
	signals := make(chan os.Signal, 4)
	signal.Notify(signals, syscall.SIGWINCH, syscall.SIGHUP, syscall.SIGTERM, syscall.SIGINT, syscall.SIGQUIT)
	defer signal.Stop(signals)

	// Not killed when ctx ends: the loop below hangs it up first.
	cmd := exec.CommandContext(context.WithoutCancel(ctx), opts.Argv[0], opts.Argv[1:]...) //nolint:gosec // the agent's own command line, built by the runner
	size, sizeErr := pty.GetsizeFull(opts.In)
	if sizeErr != nil {
		size = &pty.Winsize{Cols: 80, Rows: 24}
	}
	ptmx, err := pty.StartWithSize(cmd, size)
	if err != nil {
		return 127, err
	}
	defer func() { _ = ptmx.Close() }()
	// The program leads its own session (pty.Start), so its process group is
	// its pid, and a signal tmux sent the pane never reached it.
	group := cmd.Process.Pid
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()

	if restore, err := makeRaw(int(opts.In.Fd())); err == nil {
		defer restore()
	}

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

	drained, broken := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(drained)
		paneGone := false
		buf := make([]byte, 32<<10)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				// Reading goes on once the pane is gone, with nowhere to put
				// it: a program blocked on a full terminal could not save its
				// conversation and exit.
				if out := filter.Write(buf[:n]); len(out) > 0 && !paneGone {
					if _, werr := opts.Out.Write(out); werr != nil {
						paneGone = true
						close(broken)
					}
				}
			}
			if err != nil {
				// EIO once the program and everything it started have closed
				// the terminal: the ordinary end.
				break
			}
		}
		if rest := filter.Flush(); len(rest) > 0 && !paneGone {
			_, _ = opts.Out.Write(rest)
		}
	}()

	end := &ender{group: group, grace: grace}
	done, paneLost := ctx.Done(), broken
	for {
		select {
		case sig := <-signals:
			if sig == syscall.SIGWINCH {
				if size, err := pty.GetsizeFull(opts.In); err == nil {
					_ = pty.Setsize(ptmx, size)
				}
				continue
			}
			end.signalled(sig.(syscall.Signal))
		case <-done:
			done = nil
			end.hangUp(syscall.SIGHUP)
		case <-paneLost:
			paneLost = nil
			end.hangUp(syscall.SIGHUP)
		case <-end.deadline:
			end.kill()
		case err := <-exited:
			// What the program started and left holding its terminal gets
			// the grace period too, then goes with the group.
			wait := grace
			if end.killed {
				wait = time.Second
			}
			timer := time.NewTimer(wait)
			select {
			case <-drained:
			case <-timer.C:
				_ = syscall.Kill(-group, syscall.SIGKILL)
			}
			timer.Stop()
			return exitCode(err), nil
		}
	}
}

// ender owns how the program's process group is ended: hung up first,
// killed once the grace period is over, or at once when asked to end twice.
type ender struct {
	group int
	grace time.Duration
	// deadline fires when the grace period is over; nil until a hangup and
	// after the kill.
	deadline <-chan time.Time
	ending   bool
	killed   bool
	asked    int
}

// hangUp passes sig on to the group and starts the grace period, once.
func (e *ender) hangUp(sig syscall.Signal) {
	_ = syscall.Kill(-e.group, sig)
	if !e.ending {
		e.ending = true
		e.deadline = time.After(e.grace)
	}
}

// signalled handles a signal the wrapper was sent. Asked to end twice is
// asked to end now. Hangups do not count: closing a pane sends two, tmux's
// and the kernel's.
func (e *ender) signalled(sig syscall.Signal) {
	e.hangUp(sig)
	if sig == syscall.SIGHUP {
		return
	}
	if e.asked++; e.asked > 1 && !e.killed {
		e.kill()
	}
}

func (e *ender) kill() {
	e.killed = true
	e.deadline = nil
	_ = syscall.Kill(-e.group, syscall.SIGKILL)
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
