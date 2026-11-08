package cli

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/execpolicy"
	hostfake "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const driveCommandID = "44444444-4444-4444-8444-444444444444"

// terminalHarness is a places harness with a session of the given agent
// started in a folder, on a host whose exec policy is mode.
func terminalHarness(t *testing.T, agent string, mode hostdomain.ExecMode) *placesHarness {
	t.Helper()
	p := newPlacesHarness(t, t.TempDir(), "acct")
	policy := execpolicy.File{Path: filepath.Join(t.TempDir(), "exec.json")}
	if err := policy.Save(hostdomain.ExecPolicy{Mode: mode}); err != nil {
		t.Fatal(err)
	}
	p.h.app.Host = hostapp.New(hostapp.Options{
		Prober: hostfake.New(), ExecPolicies: policy, Executor: system.Executor{},
	})
	p.places.SetFolder("/home/jordi/code/site", true)
	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": agent,
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "site",
		"folder": "/home/jordi/code/site", "checkouts": []any{}, "cwdCheckoutId": nil,
	}))
	waitForState(t, p.svc, sessionsdomain.StateStarting)
	return p
}

func (p *placesHarness) drive(t *testing.T, body map[string]any) {
	t.Helper()
	body["commandId"], body["sessionId"] = driveCommandID, sessionUnderTest
	p.h.Message(context.Background(), message(t, "terminal.drive", body))
}

// A bot drives a blank terminal: its text is typed, its keys pressed, and it
// gets back the screen once its pattern shows. A regression that typed the
// keys as text would leave a shell that never ran the command.
func TestABotTypesIntoATerminalAndReadsItBack(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecFull)
	p.drive(t, map[string]any{"text": "ssh build-02 uptime", "keys": []any{"Enter"}, "waitFor": "uptime<Enter>", "waitSeconds": 2})

	screen := p.sent.waitFor(t, "terminal.screen", func(m any) bool {
		s, ok := m.(link.TerminalScreen)
		return ok && s.CommandID == driveCommandID
	}).(link.TerminalScreen)
	if !screen.Matched || !strings.Contains(screen.Screen, "ssh build-02 uptime<Enter>") {
		t.Fatalf("screen = %+v", screen)
	}
}

// A shell runs anything, so a host that only allows listed programs does not
// let a bot drive one; nothing is typed.
func TestATerminalIsDrivenOnlyOnAFullHost(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecAllowlist)
	p.drive(t, map[string]any{"text": "rm -rf ~", "keys": []any{"Enter"}, "waitSeconds": 0})

	failed := p.sent.waitFor(t, "command.failed", isCommandFailed(driveCommandID)).(link.CommandFailed)
	if failed.Code != hostdomain.ErrTerminalNeedsFull.Code {
		t.Fatalf("code = %s, want %s", failed.Code, hostdomain.ErrTerminalNeedsFull.Code)
	}
	for target, screen := range p.terminals.Screens {
		if strings.Contains(screen, "rm -rf") {
			t.Fatalf("typed into %s on a host that does not allow it", target)
		}
	}
}

// A coding agent's window is not a terminal to type commands into: its
// prompt has verbs of its own (send_to_session, answer_session).
func TestAnAgentSessionIsNotDrivenAsATerminal(t *testing.T) {
	p := terminalHarness(t, "claude-code", hostdomain.ExecFull)
	p.drive(t, map[string]any{"text": "ls", "waitSeconds": 0})

	failed := p.sent.waitFor(t, "command.failed", isCommandFailed(driveCommandID)).(link.CommandFailed)
	if failed.Code != sessionsdomain.ErrNotTerminal.Code {
		t.Fatalf("code = %s, want %s", failed.Code, sessionsdomain.ErrNotTerminal.Code)
	}
}
