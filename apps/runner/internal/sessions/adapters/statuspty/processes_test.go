package statuspty_test

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/statuspty"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// The runner lists the wrappers it started, by the report directory their
// command line names, and nothing else: a wrapper of another runner (another
// state directory) and the user's own processes are never listed. Ending one
// whose program ignores the hangup kills its program's group after the grace
// period. It broke when nothing ended a wrapper tmux's hangup left behind;
// listing anything broader would kill processes that are not ours.
func TestEndKillsTheRunnersOwnStrayWrapperAndNothingElse(t *testing.T) {
	ours, theirs := t.TempDir(), t.TempDir()
	reports := statuspty.New(statuspty.Options{Executable: os.Args[0], Dir: ours, Grace: 300 * time.Millisecond})
	pidFile := filepath.Join(t.TempDir(), "pid")

	stray := startAs(t, append(reports.Wrap("bold-badger-8edu4j"), "sh", "-c", stubborn), "PID_FILE="+pidFile)
	group := readPid(t, pidFile)
	foreign := startAs(t, append(statuspty.New(statuspty.Options{Executable: os.Args[0], Dir: theirs}).Wrap("other-1"),
		"sh", "-c", "sleep 1000"))
	user := exec.Command("sleep", "1000")
	if err := user.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = user.Process.Kill(); _ = user.Wait() })

	var found []app.Wrapper
	waitFor(t, func() bool {
		running, err := reports.Running(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		found = running
		return len(running) == 1 && running[0].Group == group
	})
	if found[0].SessionID != "bold-badger-8edu4j" || found[0].Pid != stray.Process.Pid {
		t.Fatalf("listed %+v, want only the wrapper in this runner's directory", found)
	}

	start := time.Now()
	if err := reports.End(context.Background(), found[0]); err != nil {
		t.Fatal(err)
	}
	if took := time.Since(start); took < 250*time.Millisecond {
		t.Fatalf("killed after %v, before the grace period was over", took)
	}
	waitExit(t, stray, 5*time.Second)
	waitGroupGone(t, group)
	for _, other := range []*exec.Cmd{foreign, user} {
		if err := other.Process.Signal(syscall.Signal(0)); err != nil {
			t.Fatalf("a process this runner did not start was ended: %v", err)
		}
	}
}

// startAs runs the test binary as the wrapper with argv[1:] for arguments,
// on a terminal of its own.
func startAs(t *testing.T, argv []string, env ...string) *exec.Cmd {
	t.Helper()
	cmd := exec.Command(os.Args[0], argv[1:]...) //nolint:gosec // the test binary itself
	cmd.Env = append(append(os.Environ(), "STATUSPTY_AS_WRAPPER=1"), env...)
	pane, err := pty.Start(cmd)
	if err != nil {
		t.Fatal(err)
	}
	go func() { _, _ = io.Copy(io.Discard, pane) }()
	t.Cleanup(func() {
		_ = pane.Close()
		if cmd.ProcessState == nil {
			// Asked twice, the wrapper kills its program's group at once.
			_ = cmd.Process.Signal(syscall.SIGTERM)
			time.Sleep(50 * time.Millisecond)
			_ = cmd.Process.Signal(syscall.SIGTERM)
			_ = cmd.Wait()
		}
	})
	return cmd
}
