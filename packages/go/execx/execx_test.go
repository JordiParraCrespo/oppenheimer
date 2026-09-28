//go:build unix

package execx_test

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

func sh(script string) execx.Spec {
	return execx.Spec{Name: "sh", Args: []string{"-c", script}}
}

func asError(t *testing.T, err error) *execx.Error {
	t.Helper()
	var e *execx.Error
	if !errors.As(err, &e) {
		t.Fatalf("want *execx.Error, got %T: %v", err, err)
	}
	return e
}

func TestTimeoutIsReportedAsTimedOut(t *testing.T) {
	spec := sh("exec sleep 5")
	spec.Timeout = 100 * time.Millisecond
	spec.WaitDelay = 500 * time.Millisecond
	start := time.Now()
	_, err := execx.Run(context.Background(), spec)
	if took := time.Since(start); took > 2*time.Second {
		t.Fatalf("returned after %s, want within the timeout plus the wait delay", took)
	}
	e := asError(t, err)
	if !e.TimedOut || e.Canceled {
		t.Fatalf("TimedOut=%v Canceled=%v, want a timeout", e.TimedOut, e.Canceled)
	}
}

func TestAParentDeadlineCountsAsTimedOut(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_, err := execx.Run(ctx, sh("exec sleep 5"))
	if e := asError(t, err); !e.TimedOut {
		t.Fatalf("TimedOut=%v, want the caller's deadline reported as a timeout", e.TimedOut)
	}
}

func TestCallerCancelIsReportedAsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(100*time.Millisecond, cancel)
	spec := sh("exec sleep 5")
	spec.Timeout = time.Minute
	_, err := execx.Run(ctx, spec)
	e := asError(t, err)
	if !e.Canceled || e.TimedOut {
		t.Fatalf("TimedOut=%v Canceled=%v, want a cancel", e.TimedOut, e.Canceled)
	}
}

// The shell starts a grandchild that inherits its stdout and prints the
// grandchild's pid, so the test can look for it afterwards.
const grandchild = "sleep 30 & echo $!; wait"

func TestKillGroupEndsAGrandchildHoldingTheOutput(t *testing.T) {
	spec := sh(grandchild)
	spec.KillGroup = true
	spec.Timeout = 100 * time.Millisecond
	spec.WaitDelay = 500 * time.Millisecond
	start := time.Now()
	res, err := execx.Run(context.Background(), spec)
	took := time.Since(start)
	if e := asError(t, err); !e.TimedOut {
		t.Fatalf("TimedOut=%v, want a timeout", e.TimedOut)
	}
	if took >= spec.Timeout+spec.WaitDelay {
		t.Fatalf("returned after %s: the group kill should close the output before the wait delay", took)
	}
	pid := pidOf(t, res.Out)
	deadline := time.Now().Add(2 * time.Second)
	for running(pid) {
		if time.Now().After(deadline) {
			t.Fatalf("grandchild %d still running after the group was killed", pid)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// Without the group kill only the shell dies; the grandchild keeps the output
// open and the call returns because WaitDelay stops waiting for it. That is
// why both exist: the delay bounds the call, the group kill ends the helpers.
func TestWithoutKillGroupOnlyTheWaitDelayEndsTheCall(t *testing.T) {
	spec := sh(grandchild)
	spec.Timeout = 100 * time.Millisecond
	spec.WaitDelay = 500 * time.Millisecond
	start := time.Now()
	res, err := execx.Run(context.Background(), spec)
	took := time.Since(start)
	if pid, perr := strconv.Atoi(strings.TrimSpace(res.Out)); perr == nil {
		t.Cleanup(func() { _ = syscall.Kill(pid, syscall.SIGKILL) })
	}
	if err == nil {
		t.Fatal("want an error")
	}
	if took < spec.Timeout+spec.WaitDelay {
		t.Fatalf("returned after %s, before the wait delay could have ended it", took)
	}
	if took > spec.Timeout+spec.WaitDelay+2*time.Second {
		t.Fatalf("returned after %s: the wait delay did not bound the call", took)
	}
}

func TestOutputIsReturnedOnFailure(t *testing.T) {
	script := "echo out; echo err >&2; echo err2 >&2; exit 3"
	for _, tc := range []struct {
		name        string
		output      execx.Output
		out         string
		first, last string
	}{
		{"combined", execx.Combined, "out\nerr\nerr2", "out", "err2"},
		{"stdout", execx.Stdout, "out", "err", "err2"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			spec := sh(script)
			spec.Output = tc.output
			res, err := execx.Run(context.Background(), spec)
			if res.Out != tc.out {
				t.Fatalf("Out = %q, want %q", res.Out, tc.out)
			}
			e := asError(t, err)
			if e.FirstLine != tc.first || e.LastLine != tc.last {
				t.Fatalf("FirstLine=%q LastLine=%q, want %q and %q", e.FirstLine, e.LastLine, tc.first, tc.last)
			}
			if e.TimedOut || e.Canceled {
				t.Fatalf("TimedOut=%v Canceled=%v on a plain failure", e.TimedOut, e.Canceled)
			}
			var exitErr *exec.ExitError
			if !errors.As(err, &exitErr) || exitErr.ExitCode() != 3 {
				t.Fatalf("want an *exec.ExitError with code 3, got %v", err)
			}
			if !errors.As(execx.Cause(err), &exitErr) {
				t.Fatalf("Cause = %T, want the *exec.ExitError", execx.Cause(err))
			}
			if got := e.Error(); got != "sh: "+tc.first {
				t.Fatalf("Error() = %q", got)
			}
		})
	}
}

func TestTrailingNewlinesAreTrimmedOnly(t *testing.T) {
	res, err := execx.Run(context.Background(), sh(`printf '  lead\n\n  inner  \n\n'`))
	if err != nil {
		t.Fatal(err)
	}
	if want := "  lead\n\n  inner  "; res.Out != want {
		t.Fatalf("Out = %q, want %q", res.Out, want)
	}
}

func TestNilEnvInheritsAndAGivenEnvIsExact(t *testing.T) {
	t.Setenv("EXECX_TEST", "inherited")
	script := `echo "${EXECX_TEST:-unset}"`

	res, err := execx.Run(context.Background(), sh(script))
	if err != nil || res.Out != "inherited" {
		t.Fatalf("nil Env: Out=%q err=%v, want the parent's value", res.Out, err)
	}

	spec := sh(script)
	spec.Env = []string{"EXECX_TEST=given"}
	if res, err = execx.Run(context.Background(), spec); err != nil || res.Out != "given" {
		t.Fatalf("given Env: Out=%q err=%v", res.Out, err)
	}

	spec.Env = []string{}
	if res, err = execx.Run(context.Background(), spec); err != nil || res.Out != "unset" {
		t.Fatalf("empty Env: Out=%q err=%v, want nothing inherited", res.Out, err)
	}
}

func TestDirIsWhereTheCommandRuns(t *testing.T) {
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	spec := sh("pwd -P")
	spec.Dir = dir
	res, err := execx.Run(context.Background(), spec)
	if err != nil || res.Out != dir {
		t.Fatalf("Out=%q err=%v, want %q", res.Out, err, dir)
	}
}

func TestAMissingCommandIsAnError(t *testing.T) {
	_, err := execx.Run(context.Background(), execx.Spec{Name: "execx-no-such-command"})
	if e := asError(t, err); e.FirstLine != "" || !strings.HasPrefix(e.Error(), "execx-no-such-command: ") {
		t.Fatalf("Error() = %q", e.Error())
	}
}

func pidOf(t *testing.T, out string) int {
	t.Helper()
	pid, err := strconv.Atoi(strings.TrimSpace(out))
	if err != nil {
		t.Fatalf("no pid in output %q", out)
	}
	return pid
}

// running reports whether pid is a live process. A zombie is not: in a
// container whose init does not reap, a killed orphan stays one.
func running(pid int) bool {
	if err := syscall.Kill(pid, 0); err != nil {
		return false
	}
	stat, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
	if err != nil {
		return true
	}
	// The state follows the command name, which is in parentheses.
	s := string(stat)
	if i := strings.LastIndexByte(s, ')'); i >= 0 && i+2 < len(s) {
		return s[i+2] != 'Z'
	}
	return true
}
