package cloud

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
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

// Unanswered, Claude Code 2.1.31x's "use this machine's settings in cloud
// sessions?" holds every start: Prepare answers it before the CLI runs.
func TestStartPreparesTheMachineBeforeTheCLIRuns(t *testing.T) {
	answered := filepath.Join(t.TempDir(), "answered")
	claude := fakeClaude(t, `[ -f '`+answered+`' ] || { echo 'Yes, send my settings'; sleep 60; }
echo 'View: https://claude.ai/code/session_01abcdefgh'
`)
	starter := Starter{
		Command: claude,
		Timeout: 5 * time.Second,
		Prepare: func() error { return os.WriteFile(answered, nil, 0o600) },
	}
	if _, err := starter.Start(context.Background(), t.TempDir(), "task"); err != nil {
		t.Fatalf("Start: %v", err)
	}
}

// A checkout that cannot be marked trusted is one the CLI would sit in until
// the timeout: the start fails at once, naming why, and the CLI never runs.
func TestStartFailsAtOnceWhenTheCheckoutCannotBeTrusted(t *testing.T) {
	ran := filepath.Join(t.TempDir(), "ran")
	claude := fakeClaude(t, "touch '"+ran+"'\nsleep 60\n")
	start := time.Now()
	_, err := Starter{
		Command: claude,
		Timeout: 30 * time.Second,
		Trust:   func(string) error { return errors.New("claude config is read-only") },
	}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) || !strings.Contains(err.Error(), "read-only") {
		t.Fatalf("err = %v, want ErrCloudStart naming the trust failure", err)
	}
	if took := time.Since(start); took > 5*time.Second {
		t.Fatalf("took %s to fail", took)
	}
	if _, statErr := os.Stat(ran); statErr == nil {
		t.Fatal("the CLI ran in a checkout that was not trusted")
	}
}

func TestStartReportsTheCLIsRefusal(t *testing.T) {
	claude := fakeClaude(t, `echo 'Error: The Claude GitHub App has no access to acme/oppenheimer.'
exit 1
`)
	_, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) {
		t.Fatalf("err = %v, want ErrCloudStart", err)
	}
	if got := err.Error(); !strings.Contains(got, "no access to acme/oppenheimer") || strings.Contains(got, "^D") {
		t.Fatalf("err = %q, want the CLI's own words", got)
	}
}

// Claude Code 2.1.x refuses a host with no claude.ai account in its renderer's
// own bytes: the cursor saved and restored around the line, a character set
// chosen after it, and a cursor move for every space. Read as the console
// showed it, that was "\x1b7\x1b8Error:Cloudsessionsneedaclaude.aisign-in…":
// the escapes as boxes and the words run together. It is its own code, the
// one refusal a person fixes on the host and then tries again.
func TestStartReportsAMissingSignInInTheCLIsWordsWithoutItsEscapes(t *testing.T) {
	claude := fakeClaude(t, `printf '\0337\0338Error:\033[1CCloud\033[1Csessions\033[1Cneed\033[1Ca\033[1Cclaude.ai\033[1Csign-in.\r\n'
printf 'Run\033[1C`+"`"+`claude\033[1Cauth\033[1Clogin`+"`"+`\033[1C(or\033[1Clog\033[1Cin\033[1Cin\033[1Ca\033[1Clocal\033[1Csession),\033[1Cthen\033[1Ctry\033[1Cagain.\r\n'
printf '\033(B\0337\0338\033(B\0337\0338\r\n'
exit 1
`)
	_, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "task")
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != domain.ErrCloudSignIn.Code {
		t.Fatalf("err = %v, want ErrCloudSignIn", err)
	}
	want := "Error: Cloud sessions need a claude.ai sign-in. · Run `claude auth login` (or log in in a local session), then try again."
	if prob.Detail != want {
		t.Fatalf("detail = %q, want %q", prob.Detail, want)
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

// A folder Claude Code still asks about holds the CLI on a question nobody
// can answer: the start fails at once with the question, not after the limit.
func TestStartFailsAtOnceOnTheTrustQuestion(t *testing.T) {
	claude := fakeClaude(t, `printf 'Yes, I trust this folder\r\nEnter to confirm\r\n'
sleep 30
`)
	start := time.Now()
	_, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) || !strings.Contains(err.Error(), "asks whether to trust") {
		t.Fatalf("err = %v, want ErrCloudStart naming the question", err)
	}
	if took := time.Since(start); took > 10*time.Second {
		t.Fatalf("took %s to give up", took)
	}
}

// The settings question Claude Code 2.1.31x asks before a cloud start holds
// the CLI as the trust question does: the start fails at once and says how to
// answer it, not after the limit.
func TestStartFailsAtOnceOnTheSettingsQuestion(t *testing.T) {
	claude := fakeClaude(t, `printf 'Use this machine'"'"'s settings in cloud sessions?\r\n> Yes, send my settings\r\n'
sleep 30
`)
	start := time.Now()
	_, err := Starter{Command: claude}.Start(context.Background(), t.TempDir(), "task")
	if !isCloudStart(err) || !strings.Contains(err.Error(), "use this machine's settings") {
		t.Fatalf("err = %v, want ErrCloudStart naming the question", err)
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

// The CLI may start helpers of its own (a hook, an MCP server) that outlive
// it. A start that left them running would leave a claude on the host for
// every cloud session, holding its scratch checkout open; stopping only the
// CLI's own process is the regression this guards.
func TestStartLeavesNothingTheCLIStartedRunning(t *testing.T) {
	pidFile := filepath.Join(t.TempDir(), "helper.pid")
	// The helper ignores the hangup the terminal's close sends, as a
	// daemonising helper does, so only an explicit stop ends it.
	claude := fakeClaude(t, `(trap '' HUP; exec sleep 300) &
echo $! > '`+pidFile+`'
echo 'View: https://claude.ai/code/session_01abcdefgh'
sleep 300
`)
	if _, err := (Starter{Command: claude}).Start(context.Background(), t.TempDir(), "task"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	raw, err := os.ReadFile(pidFile)
	if err != nil {
		t.Fatal(err)
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for running(pid) {
		if time.Now().After(deadline) {
			_ = syscall.Kill(pid, syscall.SIGKILL)
			t.Fatalf("the CLI's helper %d is still running after Start returned", pid)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// The checkout's trust is undone once the CLI is gone, not while it runs.
func TestStartForgetsTheCheckoutAfterTheCLIIsGone(t *testing.T) {
	dir := t.TempDir()
	alive := filepath.Join(t.TempDir(), "alive")
	claude := fakeClaude(t, `touch '`+alive+`'
echo 'View: https://claude.ai/code/session_01abcdefgh'
sleep 300
`)
	var forgot string
	starter := Starter{Command: claude, Forget: func(d string) {
		forgot = d
		if err := os.Remove(alive); err != nil {
			t.Errorf("forgot before the CLI ran: %v", err)
		}
	}}
	if _, err := starter.Start(context.Background(), dir, "task"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if forgot != dir {
		t.Fatalf("forgot %q, want %q", forgot, dir)
	}
}

// running reports a process that has not stopped. A zombie has: killed and
// orphaned, it waits only for an init to reap it, and a container whose init
// reaps nothing keeps it, so `kill(pid, 0)`, which still succeeds on one,
// says nothing. Linux names the state in /proc; elsewhere the signal is the
// only answer, and launchd reaps.
func running(pid int) bool {
	if syscall.Kill(pid, 0) != nil {
		return false
	}
	stat, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "stat"))
	if err != nil {
		return true
	}
	// After "pid (comm) ": comm may hold spaces and parentheses, so the
	// state is the field after the last ")".
	fields := strings.Fields(string(stat[strings.LastIndexByte(string(stat), ')')+1:]))
	return len(fields) == 0 || fields[0] != "Z"
}
