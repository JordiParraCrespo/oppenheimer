package tmux_test

import (
	"context"
	"io"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// server returns a tmux server on a socket unique to this test, and kills it
// afterwards. It skips when tmux is not installed, so the suite still runs on
// a machine that has not got it — CI installs it.
func server(t *testing.T) *tmux.Server {
	t.Helper()
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux is not installed")
	}
	socket := "opp-test-" + strings.ReplaceAll(t.Name(), "/", "-")
	s, err := tmux.New(tmux.Options{Socket: socket, ConfigPath: t.TempDir() + "/tmux.conf"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = exec.Command("tmux", "-L", socket, "kill-server").Run() //nolint:errcheck // best effort
	})
	return s
}

func TestCreateListAndKillASession(t *testing.T) {
	s := server(t)
	ctx := context.Background()
	if err := s.Available(ctx); err != nil {
		t.Fatal(err)
	}

	if err := s.Create(ctx, "opp-abc", t.TempDir(), "", nil); err != nil {
		t.Fatalf("create: %v", err)
	}

	names, err := s.List(ctx)
	if err != nil || len(names) != 1 || names[0] != "opp-abc" {
		t.Fatalf("list = %v, err = %v", names, err)
	}
	if has, err := s.Has(ctx, "opp-abc"); err != nil || !has {
		t.Fatalf("has = %v, err = %v", has, err)
	}

	if err := s.Kill(ctx, "opp-abc"); err != nil {
		t.Fatalf("kill: %v", err)
	}
	if has, _ := s.Has(ctx, "opp-abc"); has {
		t.Fatal("the session is still there after kill")
	}
}

func TestListOnAHostWithNoServerIsEmptyNotAnError(t *testing.T) {
	s := server(t)

	names, err := s.List(context.Background())

	if err != nil {
		t.Fatalf("a host that has never opened a session is not an error: %v", err)
	}
	if len(names) != 0 {
		t.Fatalf("names = %v", names)
	}
}

func TestKillingASessionThatIsAlreadyGoneSucceeds(t *testing.T) {
	// The caller wanted it gone, and it is gone.
	if err := server(t).Kill(context.Background(), "opp-never-existed"); err != nil {
		t.Fatalf("kill: %v", err)
	}
}

func TestWindowsAreTheSessionsTabs(t *testing.T) {
	s := server(t)
	ctx := context.Background()
	dir := t.TempDir()
	if err := s.Create(ctx, "opp-tabs", dir, "", nil); err != nil {
		t.Fatal(err)
	}

	index, err := s.NewWindow(ctx, "opp-tabs", dir)
	if err != nil {
		t.Fatalf("new-window: %v", err)
	}
	if index == 0 {
		t.Fatal("a new tab must not be window 0, which is the agent's")
	}

	windows, err := s.Windows(ctx, "opp-tabs")
	if err != nil || len(windows) != 2 {
		t.Fatalf("windows = %v, err = %v", windows, err)
	}
	if !windows[0].Agent || windows[1].Agent {
		t.Fatalf("window 0 is the agent's: %+v", windows)
	}

	if err := s.KillWindow(ctx, "opp-tabs:"+itoa(index)); err != nil {
		t.Fatalf("kill-window: %v", err)
	}
	windows, _ = s.Windows(ctx, "opp-tabs")
	if len(windows) != 1 {
		t.Fatalf("windows after closing a tab = %v", windows)
	}
}

func TestTheEnvironmentIsInheritedByEveryWindow(t *testing.T) {
	s := server(t)
	ctx := context.Background()
	dir := t.TempDir()
	// The session id and the runner's socket are set once, at creation, so
	// a git credential helper called from any tab knows who it answers for.
	env := map[string]string{"OPPENHEIMER_SESSION": "abc123"}
	if err := s.Create(ctx, "opp-env", dir, "", env); err != nil {
		t.Fatal(err)
	}
	index, err := s.NewWindow(ctx, "opp-env", dir)
	if err != nil {
		t.Fatal(err)
	}

	if err := s.SendKeys(ctx, "opp-env:"+itoa(index), "printf '[%s]' \"$OPPENHEIMER_SESSION\"\n"); err != nil {
		t.Fatal(err)
	}
	screen := waitFor(t, s, "opp-env:"+itoa(index), "[abc123]")
	if !strings.Contains(screen, "[abc123]") {
		t.Fatalf("a later tab did not inherit the session environment:\n%s", screen)
	}
}

func TestCaptureReadsWhatTheAgentPrinted(t *testing.T) {
	s := server(t)
	ctx := context.Background()
	if err := s.Create(ctx, "opp-capture", t.TempDir(), "", nil); err != nil {
		t.Fatal(err)
	}

	if err := s.SendKeys(ctx, "opp-capture:0", "echo hello-from-the-pane\n"); err != nil {
		t.Fatal(err)
	}

	if screen := waitFor(t, s, "opp-capture:0", "hello-from-the-pane"); !strings.Contains(screen, "hello-from-the-pane") {
		t.Fatalf("capture:\n%s", screen)
	}
}

func TestAttachStreamsAndDetachingLeavesTheSessionRunning(t *testing.T) {
	s := server(t)
	ctx := context.Background()
	if err := s.Create(ctx, "opp-attach", t.TempDir(), "", nil); err != nil {
		t.Fatal(err)
	}

	attachment, err := s.Attach(ctx, "opp-attach:0", app.Size{Cols: 80, Rows: 24})
	if err != nil {
		t.Fatalf("attach: %v", err)
	}
	if _, err := io.WriteString(attachment, "echo streamed-through-the-pty\n"); err != nil {
		t.Fatal(err)
	}
	if !readUntil(t, attachment, "streamed-through-the-pty") {
		t.Fatal("nothing came back through the PTY")
	}
	if err := attachment.Resize(app.Size{Cols: 100, Rows: 30}); err != nil {
		t.Fatalf("resize: %v", err)
	}

	// Closing a tab detaches; it does not end the session.
	if err := attachment.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if has, err := s.Has(ctx, "opp-attach"); err != nil || !has {
		t.Fatal("detaching must leave the session running — that is the whole product")
	}
}

// waitFor polls capture-pane until the text shows up or the deadline passes.
func waitFor(t *testing.T, s *tmux.Server, target, want string) string {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	var screen string
	for time.Now().Before(deadline) {
		var err error
		screen, err = s.Capture(context.Background(), target)
		if err == nil && strings.Contains(screen, want) {
			return screen
		}
		time.Sleep(50 * time.Millisecond)
	}
	return screen
}

func readUntil(t *testing.T, r io.Reader, want string) bool {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	var seen strings.Builder
	buf := make([]byte, 4096)
	for time.Now().Before(deadline) {
		n, err := r.Read(buf)
		if n > 0 {
			seen.Write(buf[:n])
			if strings.Contains(seen.String(), want) {
				return true
			}
		}
		if err != nil {
			return false
		}
	}
	return false
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
