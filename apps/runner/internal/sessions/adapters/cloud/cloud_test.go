package cloud

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// fakeClaude writes a stand-in for the CLI that prints script when it is run
// in a terminal, and refuses as the real one does when it is not.
func fakeClaude(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "claude")
	body := "#!/bin/sh\n" +
		"[ -t 1 ] || { echo 'Error: --cloud requires an interactive terminal.' >&2; exit 1; }\n" +
		"[ \"$1\" = --cloud ] || { echo \"unexpected args: $*\"; exit 2; }\n" +
		script
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestStartReadsTheSessionTheCLINamed(t *testing.T) {
	claude := fakeClaude(t, `printf '\033[1mCreated cloud session: Fix the login\033[0m\r\n'
printf 'View: https://claude.ai/code/session_014a8EH8DJs95X1iK8ZH9Y82?from=cli&m=0\r\n'
printf 'Resume with: claude --teleport session_014a8EH8DJs95X1iK8ZH9Y82\r\n'
`)
	started, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "Fix the login")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	want := Started{
		ID:    "session_014a8EH8DJs95X1iK8ZH9Y82",
		URL:   "https://claude.ai/code/session_014a8EH8DJs95X1iK8ZH9Y82",
		Title: "Fix the login",
	}
	if started != want {
		t.Fatalf("started = %+v, want %+v", started, want)
	}
}

func TestStartRunsInTheCheckout(t *testing.T) {
	dir := t.TempDir()
	claude := fakeClaude(t, `[ "$(pwd -P)" = "`+mustReal(t, dir)+`" ] || { echo "ran in $(pwd)"; exit 3; }
echo 'View: https://claude.ai/code/session_01abcdefgh'
`)
	if _, err := (Starter{Command: claude}).Start(context.Background(), dir, "task"); err != nil {
		t.Fatalf("Start: %v", err)
	}
}

// A scratch checkout is a folder Claude Code has never seen: unless it is
// trusted before the CLI runs, the CLI sits on its trust question until the
// start times out.
func TestStartTrustsTheCheckoutBeforeTheCLIRuns(t *testing.T) {
	dir := t.TempDir()
	trusted := filepath.Join(t.TempDir(), "trusted")
	claude := fakeClaude(t, `[ "$(cat '`+trusted+`' 2>/dev/null)" = "$(pwd -P)" ] || { echo 'Yes, I trust this folder'; sleep 60; }
echo 'View: https://claude.ai/code/session_01abcdefgh'
`)
	starter := Starter{
		Command: claude,
		Timeout: 5 * time.Second,
		Trust: func(dir string) error {
			return os.WriteFile(trusted, []byte(mustReal(t, dir)), 0o600)
		},
	}
	if _, err := starter.Start(context.Background(), dir, "task"); err != nil {
		t.Fatalf("Start: %v", err)
	}
}

func TestStartReportsTheCLIsRefusal(t *testing.T) {
	claude := fakeClaude(t, `echo 'Error: You are not signed in to claude.ai. Run /login.'
exit 1
`)
	_, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) {
		t.Fatalf("err = %v, want ErrCloudStart", err)
	}
	if got := err.Error(); !strings.Contains(got, "not signed in to claude.ai") || strings.Contains(got, "^D") {
		t.Fatalf("err = %q, want the CLI's own words", got)
	}
}

func TestStartGivesUpOnACLIThatNamesNothing(t *testing.T) {
	claude := fakeClaude(t, "sleep 30\n")
	start := time.Now()
	_, err := Starter{Command: claude, Timeout: 500 * time.Millisecond}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) {
		t.Fatalf("err = %v, want ErrCloudStart", err)
	}
	if took := time.Since(start); took > 10*time.Second {
		t.Fatalf("took %s to give up", took)
	}
}

func isCloudStart(err error) bool {
	var prob *problem.Error
	return errors.As(err, &prob) && prob.Code == domain.ErrCloudStart.Code
}

func mustReal(t *testing.T, dir string) string {
	t.Helper()
	real, err := filepath.EvalSymlinks(dir)
	if err != nil {
		t.Fatal(err)
	}
	return real
}
