package statuspty_test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
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
		report := args[0]
		code, err := statuspty.Run(context.Background(), statuspty.RunOptions{Argv: args[1:], Report: report, In: os.Stdin, Out: os.Stdout})
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
