package statuspty_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/creack/pty"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/statuspty"
)

// The test binary doubles as `runner pty`, so the wrapper runs as its own
// process on a real terminal, the way tmux runs it in a pane.
func TestMain(m *testing.M) {
	if os.Getenv("STATUSPTY_AS_WRAPPER") == "1" {
		args := os.Args[1:]
		// The words Wrap gives, `pty --report FILE --`, or just FILE.
		if len(args) > 4 && args[0] == "pty" {
			args = append([]string{args[2]}, args[4:]...)
		}
		report := args[0]
		grace, _ := time.ParseDuration(os.Getenv("STATUSPTY_GRACE"))
		code, err := statuspty.Run(context.Background(), statuspty.RunOptions{
			Argv: args[1:], Report: report, In: os.Stdin, Out: os.Stdout, Grace: grace,
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
		}
		os.Exit(code)
	}
	os.Exit(m.Run())
}

// agent stands in for Claude Code: it probes the terminal, writes down what
// came back, reports that it is blocked on a permission, waits for a key,
// and exits with a code of its own.
const agent = `stty raw -echo
printf '\033]7501;?\033\\'
reply=$(dd bs=1 count=80 2>/dev/null)
printf '%s' "$reply" > "$REPLY_FILE"
printf 'before\033]7501;state=blocked:app=claude-code:kind=permission:msg=UnVuIHRlc3RzPw==\033\\after\n'
dd bs=1 count=1 >/dev/null 2>&1
printf '\033]7501;state=working\007'
exit 7`

type screen struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (s *screen) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.Write(p)
}

func (s *screen) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.String()
}

func TestWrapperAnswersTheProbeAndKeepsTheReport(t *testing.T) {
	dir := t.TempDir()
	reports := statuspty.New(statuspty.Options{Executable: "/unused", Dir: dir})
	words := reports.Wrap("s1")
	report := words[3]
	replyFile := filepath.Join(dir, "reply")

	cmd := exec.Command(os.Args[0], report, "sh", "-c", agent) //nolint:gosec // the test binary itself
	cmd.Env = append(os.Environ(), "STATUSPTY_AS_WRAPPER=1", "REPLY_FILE="+replyFile)
	pane, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: 100, Rows: 30})
	if err != nil {
		t.Fatal(err)
	}
	defer pane.Close()
	var seen screen
	go func() { _, _ = io.Copy(&seen, pane) }()

	waitFor(t, func() bool { return strings.Contains(seen.String(), "after") })
	got, ok := reports.Read("s1")
	if !ok {
		t.Fatal("no report while the agent runs")
	}
	root, _ := got.Root()
	if root.State != "blocked" || root.Kind != "permission" || root.Message != "Run tests?" {
		t.Fatalf("root %+v", root)
	}
	reply, _ := os.ReadFile(replyFile)
	if !strings.HasPrefix(string(reply), "\x1b]7501;?:states=") {
		t.Fatalf("the probe was answered with %q", reply)
	}

	_, _ = pane.Write([]byte("x"))
	err = cmd.Wait()
	var exit *exec.ExitError
	if !errorsAs(err, &exit) || exit.ExitCode() != 7 {
		t.Fatalf("wrapper ended with %v, want the agent's exit 7", err)
	}
	if strings.Contains(seen.String(), "7501") {
		t.Fatalf("the pane saw a 7501 sequence: %q", seen.String())
	}
	if !strings.Contains(seen.String(), "beforeafter") {
		t.Fatalf("the bytes around the report did not reach the pane in order: %q", seen.String())
	}
	if _, ok := reports.Read("s1"); ok {
		t.Fatal("the report outlived the agent")
	}
}

// A report file a killed wrapper left behind is nobody's word.
func TestReportsIgnoreAFileWithNoWrapper(t *testing.T) {
	dir := t.TempDir()
	reports := statuspty.New(statuspty.Options{Executable: "/unused", Dir: dir})
	body := `{"pid": 999999999, "report": {"records": {"": {"state": "working"}}, "reported": true, "turn": 0}}`
	if err := os.WriteFile(filepath.Join(dir, "s2.json"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, ok := reports.Read("s2"); ok {
		t.Fatal("read a report whose wrapper is gone")
	}
	if words := reports.Wrap("../etc"); words != nil {
		t.Fatalf("a session id that is a path named a file: %v", words)
	}
}

// stubborn stands in for an agent that does not exit on hangup, which is
// what Claude Code was seen doing: it and the sleep it waits on ignore
// SIGHUP and SIGTERM.
const stubborn = `trap "" HUP TERM
echo $$ > "$PID_FILE"
while :; do echo still here; sleep 1; done`

// A hung-up wrapper whose program ignores the hangup still ends, once the
// grace period is over, and takes the program's whole process group with
// it. It broke when the wrapper only forwarded the signal and waited for the
// program to close its terminal: ~110 idle agents outlived their panes.
func TestWrapperKillsAProgramThatIgnoresTheHangup(t *testing.T) {
	pidFile := filepath.Join(t.TempDir(), "pid")
	cmd, pane := startWrapper(t, "500ms", stubborn, "PID_FILE="+pidFile)
	defer pane.Close()
	go func() { _, _ = io.Copy(io.Discard, pane) }()
	group := readPid(t, pidFile)

	start := time.Now()
	if err := cmd.Process.Signal(syscall.SIGHUP); err != nil {
		t.Fatal(err)
	}
	err := waitExit(t, cmd, 5*time.Second)
	if took := time.Since(start); took < 400*time.Millisecond {
		t.Fatalf("killed after %v, before the grace period was over", took)
	}
	var exit *exec.ExitError
	if !errorsAs(err, &exit) || exit.ExitCode() != 128+int(syscall.SIGKILL) {
		t.Fatalf("wrapper ended with %v, want the program's kill", err)
	}
	waitGroupGone(t, group)
}

// A program that exits on hangup ends on its own and its exit code is the
// wrapper's: the hangup is what lets an agent save its conversation, so it
// comes first and is not cut short. It breaks if the wrapper kills at once.
func TestWrapperLetsAHungUpProgramExitOnItsOwn(t *testing.T) {
	pidFile := filepath.Join(t.TempDir(), "pid")
	cmd, pane := startWrapper(t, "30s", `trap 'exit 3' HUP
echo $$ > "$PID_FILE"
while :; do sleep 0.1; done`, "PID_FILE="+pidFile)
	defer pane.Close()
	go func() { _, _ = io.Copy(io.Discard, pane) }()
	readPid(t, pidFile)

	if err := cmd.Process.Signal(syscall.SIGHUP); err != nil {
		t.Fatal(err)
	}
	err := waitExit(t, cmd, 5*time.Second)
	var exit *exec.ExitError
	if !errorsAs(err, &exit) || exit.ExitCode() != 3 {
		t.Fatalf("wrapper ended with %v, want the program's own exit 3", err)
	}
}

// A pane that stops taking output (tmux closed it) ends the program the way
// a hangup does, and Run returns. It broke when a failed write left Run in
// cmd.Wait for a program that was never told to go.
func TestRunReturnsOnceItsPaneIsGone(t *testing.T) {
	pidFile := filepath.Join(t.TempDir(), "pid")
	t.Setenv("PID_FILE", pidFile)
	in, keys, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer keys.Close()
	defer in.Close()
	gone, out, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	_ = gone.Close()

	returned := make(chan int, 1)
	go func() {
		code, _ := statuspty.Run(context.Background(), statuspty.RunOptions{
			Argv: []string{"sh", "-c", stubborn}, In: in, Out: out, Grace: 300 * time.Millisecond,
		})
		returned <- code
	}()
	group := readPid(t, pidFile)
	select {
	case code := <-returned:
		if code != 128+int(syscall.SIGKILL) {
			t.Fatalf("Run returned %d, want the program's kill", code)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run is still waiting on a program whose pane is gone")
	}
	waitGroupGone(t, group)
}

// startWrapper runs the test binary as `runner pty` on a terminal of its
// own, the way tmux runs it in a pane, around `sh -c script`.
func startWrapper(t *testing.T, grace, script string, env ...string) (*exec.Cmd, *os.File) {
	t.Helper()
	cmd := exec.Command(os.Args[0], "", "sh", "-c", script) //nolint:gosec // the test binary itself
	cmd.Env = append(append(os.Environ(), "STATUSPTY_AS_WRAPPER=1", "STATUSPTY_GRACE="+grace), env...)
	pane, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: 100, Rows: 30})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if cmd.ProcessState == nil {
			_ = cmd.Process.Kill()
		}
	})
	return cmd, pane
}

// readPid waits for the program to write its pid, which is its process
// group: it leads a session of its own.
func readPid(t *testing.T, path string) int {
	t.Helper()
	var pid int
	waitFor(t, func() bool {
		body, err := os.ReadFile(path) //nolint:gosec // the test's own temp file
		if err != nil {
			return false
		}
		pid, err = strconv.Atoi(strings.TrimSpace(string(body)))
		return err == nil
	})
	return pid
}

func waitExit(t *testing.T, cmd *exec.Cmd, limit time.Duration) error {
	t.Helper()
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	select {
	case err := <-exited:
		return err
	case <-time.After(limit):
		t.Fatalf("the wrapper did not end within %v", limit)
		return nil
	}
}

func waitGroupGone(t *testing.T, group int) {
	t.Helper()
	waitFor(t, func() bool { return errors.Is(syscall.Kill(-group, 0), syscall.ESRCH) })
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func errorsAs(err error, target **exec.ExitError) bool {
	e, ok := err.(*exec.ExitError) //nolint:errorlint // Wait returns it unwrapped
	if ok {
		*target = e
	}
	return ok
}
