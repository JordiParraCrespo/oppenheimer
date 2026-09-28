// Package execx runs a command to completion the one way this repo does:
// bounded by a timeout, its output collected, and — once cancelled — the wait
// for leftover output bounded, with the whole process group killed when the
// caller asks for it.
//
// It is for run-and-collect calls only. A long-lived process on a PTY, or one
// whose output is streamed, is started with os/exec directly.
package execx

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"strings"
	"time"
)

// DefaultWaitDelay is how long a finished or killed command's output is
// waited on when Spec.WaitDelay is zero.
const DefaultWaitDelay = 5 * time.Second

// Output picks which of the command's streams Result.Out holds.
type Output int

const (
	// Combined interleaves stdout and stderr, as exec.Cmd.CombinedOutput does.
	Combined Output = iota
	// Stdout keeps stdout only, as exec.Cmd.Output does. stderr is still
	// collected, for Error's FirstLine and LastLine.
	Stdout
)

// Spec is one command.
type Spec struct {
	Name string
	Args []string
	// Dir is where the command runs; empty is the calling process's directory.
	Dir string
	// Env is the command's whole environment. nil inherits os.Environ();
	// anything else is used as given, so a caller adding variables appends
	// them to os.Environ() itself.
	Env []string
	// Timeout bounds the command; zero leaves only the caller's ctx.
	Timeout time.Duration
	// KillGroup runs the command in a process group of its own and, when the
	// context ends, kills the group rather than the command alone, so helpers
	// it started go too. It is a no-op where there are no process groups.
	// Leave it off for a command that starts a daemon meant to outlive it.
	KillGroup bool
	// WaitDelay bounds how long output is waited on once the command has
	// exited or been killed: a child that inherited the output and outlived
	// it would otherwise hold the call open. Zero is DefaultWaitDelay.
	WaitDelay time.Duration
	// Output is which streams Result.Out holds.
	Output Output
}

// Result is what a command printed.
type Result struct {
	// Out is the collected output with its trailing newlines trimmed and
	// nothing else touched. It is set on failure too: a failed command's
	// output is usually the reason.
	Out string
}

// Error is what Run returns when the command did not succeed. It wraps the
// exec error, so errors.As(err, &exitErr) still finds an *exec.ExitError.
type Error struct {
	Name string
	// Err is the error os/exec returned: an *exec.ExitError, a start failure,
	// exec.ErrWaitDelay, or a context error.
	Err error
	// TimedOut is set when the context the command ran under hit its
	// deadline: Spec.Timeout, or a deadline the caller's ctx already had.
	TimedOut bool
	// Canceled is set when the caller's ctx was cancelled.
	Canceled bool
	// FirstLine and LastLine are the first and last non-empty lines of the
	// collected output, trimmed; in Stdout mode, of stderr.
	FirstLine string
	LastLine  string
}

func (e *Error) Error() string {
	if e.FirstLine != "" {
		return e.Name + ": " + e.FirstLine
	}
	return e.Name + ": " + e.Err.Error()
}

func (e *Error) Unwrap() error { return e.Err }

// Cause is the error os/exec itself returned for err, for a caller whose
// messages quote it; any other error comes back unchanged.
func Cause(err error) error {
	var e *Error
	if errors.As(err, &e) {
		return e.Err
	}
	return err
}

// Run runs spec to completion. On failure it returns the output collected so
// far with an *Error.
func Run(ctx context.Context, spec Spec) (Result, error) {
	runCtx := ctx
	if spec.Timeout > 0 {
		var cancel context.CancelFunc
		runCtx, cancel = context.WithTimeout(ctx, spec.Timeout)
		defer cancel()
	}

	cmd := exec.CommandContext(runCtx, spec.Name, spec.Args...) //nolint:gosec // running the caller's command is this package's purpose
	cmd.Dir = spec.Dir
	cmd.Env = spec.Env
	if spec.KillGroup {
		killGroupOnCancel(cmd)
	}
	cmd.WaitDelay = spec.WaitDelay
	if cmd.WaitDelay <= 0 {
		cmd.WaitDelay = DefaultWaitDelay
	}

	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	if spec.Output == Stdout {
		cmd.Stderr = &stderr
	} else {
		// The same writer for both, which is what makes os/exec share one
		// pipe and keep the two streams in the order they were written.
		cmd.Stderr = &out
	}

	err := cmd.Run()
	text := strings.TrimRight(out.String(), "\n")
	if err == nil {
		return Result{Out: text}, nil
	}
	said := text
	if spec.Output == Stdout {
		said = stderr.String()
	}
	first, last := lines(said)
	return Result{Out: text}, &Error{
		Name:      spec.Name,
		Err:       err,
		TimedOut:  errors.Is(runCtx.Err(), context.DeadlineExceeded),
		Canceled:  errors.Is(runCtx.Err(), context.Canceled),
		FirstLine: first,
		LastLine:  last,
	}
}

// lines returns the first and last non-empty lines of s, trimmed.
func lines(s string) (first, last string) {
	for line := range strings.SplitSeq(s, "\n") {
		if line = strings.TrimSpace(line); line == "" {
			continue
		}
		if first == "" {
			first = line
		}
		last = line
	}
	return first, last
}
