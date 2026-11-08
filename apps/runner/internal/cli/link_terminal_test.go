package cli

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

// target is the session's window 0, where the fake keeps its screen.
func (p *placesHarness) target(t *testing.T) string {
	t.Helper()
	session, err := p.svc.Get(sessionUnderTest)
	if err != nil {
		t.Fatal(err)
	}
	return session.Target(0)
}

func (p *placesHarness) screen(t *testing.T) link.TerminalScreen {
	t.Helper()
	return p.sent.waitFor(t, "terminal.screen", func(m any) bool {
		s, ok := m.(link.TerminalScreen)
		return ok && s.CommandID == driveCommandID
	}).(link.TerminalScreen)
}

// A bot drives a blank terminal: its text is typed and its keys pressed, and
// it gets the screen back once its pattern shows. A regression that typed the
// keys as text would leave a shell that never ran the command.
func TestABotTypesIntoATerminalAndReadsItBack(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecFull)
	p.drive(t, map[string]any{"text": "uptime", "keys": []any{"Enter"}, "waitSeconds": 0})

	screen := p.screen(t)
	if !strings.Contains(screen.Screen, "uptime<Enter>") {
		t.Fatalf("screen = %+v", screen)
	}
}

// A pattern already on the screen, or in the line just typed, is not the
// answer to what was typed: a password prompt left from a failed try must not
// read as the next one, or the bot answers before the program asks.
func TestAMatchAlreadyOnTheScreenIsNotTheAnswer(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecFull)
	p.terminals.Screens[p.target(t)] = "password: \n"
	p.drive(t, map[string]any{"text": "password: retry", "keys": []any{"Enter"}, "waitFor": "password:", "waitSeconds": 1})

	if screen := p.screen(t); screen.Matched {
		t.Fatalf("matched a prompt that was there before typing: %+v", screen)
	}
}

// A drive that only reads takes what is on the screen now.
func TestAReadMatchesWhatIsAlreadyThere(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecFull)
	p.terminals.Screens[p.target(t)] = "jordi@build-02:~$ "
	p.drive(t, map[string]any{"waitFor": "\\$ $", "waitSeconds": 1})

	if screen := p.screen(t); !screen.Matched {
		t.Fatalf("a read missed the prompt on screen: %+v", screen)
	}
}

// A retried approved drive arrives with the command id of its first try: it
// is answered from that try, and its text is not typed a second time.
func TestARetriedDriveIsNotTypedTwice(t *testing.T) {
	p := terminalHarness(t, "shell", hostdomain.ExecFull)
	p.drive(t, map[string]any{"text": "rm build", "keys": []any{"Enter"}, "waitSeconds": 0})
	p.screen(t)
	p.drive(t, map[string]any{"text": "rm build", "keys": []any{"Enter"}, "waitSeconds": 0})
	deadline := time.Now().Add(2 * time.Second)
	for p.screens() < 2 {
		if time.Now().After(deadline) {
			t.Fatal("the retry was not answered")
		}
		time.Sleep(time.Millisecond)
	}
	if got := strings.Count(p.terminals.Screens[p.target(t)], "rm build"); got != 1 {
		t.Fatalf("typed %d times", got)
	}
}

func (p *placesHarness) screens() int {
	p.sent.mu.Lock()
	defer p.sent.mu.Unlock()
	count := 0
	for _, sent := range p.sent.sent {
		if s, ok := sent.(link.TerminalScreen); ok && s.CommandID == driveCommandID {
			count++
		}
	}
	return count
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
