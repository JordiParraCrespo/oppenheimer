package cli

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/execpolicy"
	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

const execCommandID = "33333333-3333-4333-8333-333333333333"

// execHarness is a handler on a link that is up, whose host runs bots'
// commands for real, with the policy file and the workspaces in temp dirs.
type execHarness struct {
	h          *linkHandler
	sent       *capturedLink
	policy     execpolicy.File
	workspaces string
}

func newExecHarness(t *testing.T) *execHarness {
	t.Helper()
	workspaces := t.TempDir()
	policy := execpolicy.File{Path: filepath.Join(t.TempDir(), "exec.json")}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	h := &linkHandler{
		app: &App{Host: hostapp.New(hostapp.Options{
			Prober: hostfake.New(), WorkspaceRoot: workspaces,
			ExecPolicies: policy, Executor: system.Executor{},
		})},
		identity: pairdomain.Identity{HostID: "host-1", AccountID: "acct"},
		logger:   logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(5 * time.Second) })
	h.Connected(context.Background(), 1)
	return &execHarness{h: h, sent: sent, policy: policy, workspaces: workspaces}
}

func (e *execHarness) allow(t *testing.T, policy hostdomain.ExecPolicy) {
	t.Helper()
	if err := e.policy.Save(policy); err != nil {
		t.Fatal(err)
	}
}

func (e *execHarness) run(t *testing.T, argv []string, timeout int) {
	t.Helper()
	args := make([]any, len(argv))
	for i, arg := range argv {
		args[i] = arg
	}
	e.h.Message(context.Background(), message(t, "host.exec", map[string]any{
		"commandId": execCommandID, "argv": args, "home": "juno", "timeoutSeconds": timeout,
	}))
}

func (e *execHarness) result(t *testing.T) link.HostExecResult {
	t.Helper()
	return e.sent.waitFor(t, "host.exec.result", func(m any) bool {
		r, ok := m.(link.HostExecResult)
		return ok && r.CommandID == execCommandID
	}).(link.HostExecResult)
}

// A host nobody set up runs nothing and makes nothing: off is the default,
// so pairing a machine never hands its shell to a bot.
func TestAHostRunsNoCommandUntilItsOwnerAllowsIt(t *testing.T) {
	e := newExecHarness(t)
	e.run(t, []string{"echo", "hi"}, 5)

	failed := e.sent.waitFor(t, "command.failed", isCommandFailed(execCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrExecDisabled.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrExecDisabled.Code)
	}
	if _, err := os.Stat(filepath.Join(e.workspaces, hostdomain.BotsDir)); !os.IsNotExist(err) {
		t.Fatal("a refused command made the bot's folder")
	}
}

// The allowlist is the program that actually runs: argv goes to the program
// whole, never through a shell, so `;` cannot start a second command.
func TestAnAllowedProgramRunsWithItsArgumentsAsGiven(t *testing.T) {
	e := newExecHarness(t)
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecAllowlist, Allow: []string{"echo"}})
	e.run(t, []string{"echo", "a;", "rm", "-rf", "$HOME"}, 5)

	r := e.result(t)
	if r.ExitCode == nil || *r.ExitCode != 0 || r.Stdout != "a; rm -rf $HOME" {
		t.Fatalf("result = %+v", r)
	}
	want := filepath.Join(e.workspaces, hostdomain.BotsDir, "juno")
	if r.Cwd != want {
		t.Fatalf("cwd = %s, want the bot's own folder %s", r.Cwd, want)
	}
	if info, err := os.Stat(want); err != nil || !info.IsDir() {
		t.Fatal("the bot's folder was not kept")
	}
}

// A program the list does not name is refused with the code the bot reads,
// before anything runs.
func TestAProgramOffTheAllowlistIsRefused(t *testing.T) {
	e := newExecHarness(t)
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecAllowlist, Allow: []string{"echo"}})
	e.run(t, []string{"sh", "-c", "echo hi"}, 5)

	failed := e.sent.waitFor(t, "command.failed", isCommandFailed(execCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrExecRefused.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrExecRefused.Code)
	}
}

// A program that fails is a result the bot can read, not a refusal: its exit
// code and stderr are the answer.
func TestAFailingProgramReportsItsExitCodeAndStderr(t *testing.T) {
	e := newExecHarness(t)
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecFull})
	e.run(t, []string{"sh", "-c", "echo out; echo broke >&2; exit 3"}, 5)

	r := e.result(t)
	if r.ExitCode == nil || *r.ExitCode != 3 || r.Stdout != "out" || r.Stderr != "broke" || r.TimedOut {
		t.Fatalf("result = %+v", r)
	}
}

// A run past its timeout is ended, its children with it, and says so rather
// than reporting an exit code it never had.
func TestARunPastItsTimeoutIsKilled(t *testing.T) {
	e := newExecHarness(t)
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecFull})
	e.run(t, []string{"sh", "-c", "sleep 30 & sleep 30"}, 1)

	r := e.result(t)
	if !r.TimedOut || r.ExitCode != nil {
		t.Fatalf("result = %+v, want timed out with no exit code", r)
	}
}

// A path that reads, as text, as an allowed script but would reach the bot's
// own file once the kernel followed a symlink in its folder. The check and the
// run must be on the same file: what runs is the file the policy allowed,
// never the one beside the symlink.
func TestTheProgramThatRunsIsTheOneThePolicyChecked(t *testing.T) {
	e := newExecHarness(t)
	root := t.TempDir()
	allowed := filepath.Join(root, "scripts")
	repo := filepath.Join(root, "repo")
	for _, dir := range []string{allowed, filepath.Join(repo, "scripts"), filepath.Join(repo, "evil", "a")} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(allowed, "report.sh"), []byte("#!/bin/sh\necho allowed\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "scripts", "report.sh"), []byte("#!/bin/sh\necho bots-own\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	lnk := filepath.Join(repo, "lnk")
	if err := os.Symlink(filepath.Join(repo, "evil", "a"), lnk); err != nil {
		t.Fatal(err)
	}
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecAllowlist, Allow: []string{filepath.Join(allowed, "*")}})

	e.h.Message(context.Background(), message(t, "host.exec", map[string]any{
		"commandId": execCommandID, "argv": []any{"../../scripts/report.sh"}, "cwd": lnk,
		"home": "juno", "timeoutSeconds": 5,
	}))
	if r := e.result(t); r.Stdout != "allowed" {
		t.Fatalf("stdout = %q: a file the policy did not check ran", r.Stdout)
	}
}

// A symlink that points out of an allowed folder is judged by where it
// points: the bot cannot plant a link inside the list to a file of its own.
func TestALinkOutOfAnAllowedFolderIsJudgedByItsTarget(t *testing.T) {
	e := newExecHarness(t)
	root := t.TempDir()
	allowed := filepath.Join(root, "scripts")
	if err := os.MkdirAll(allowed, 0o755); err != nil {
		t.Fatal(err)
	}
	own := filepath.Join(root, "own.sh")
	if err := os.WriteFile(own, []byte("#!/bin/sh\necho bots-own\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(own, filepath.Join(allowed, "report.sh")); err != nil {
		t.Fatal(err)
	}
	e.allow(t, hostdomain.ExecPolicy{Mode: hostdomain.ExecAllowlist, Allow: []string{filepath.Join(allowed, "*")}})
	e.run(t, []string{filepath.Join(allowed, "report.sh")}, 5)

	failed := e.sent.waitFor(t, "command.failed", isCommandFailed(execCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrExecRefused.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrExecRefused.Code)
	}
}
