package cli

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// isSessionWindows matches the `session.windows` that answers commandID.
func isSessionWindows(commandID string) func(any) bool {
	return func(m any) bool {
		reply, ok := m.(link.SessionWindows)
		return ok && reply.CommandID == commandID
	}
}

func windowIndexes(windows []link.Window) []int {
	out := make([]int, 0, len(windows))
	for _, w := range windows {
		out = append(out, w.Index)
	}
	return out
}

// Opening, listing and closing a shell each answer with the session's
// windows after the command, and an open names the window it made: without
// that the console could not attach to the shell it asked for.
func TestWindowCommandsAnswerWithTheSessionsWindows(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	const open, list, closing = "a1111111-1111-4111-8111-111111111111",
		"a2222222-2222-4222-8222-222222222222", "a3333333-3333-4333-8333-333333333333"
	p.h.Message(context.Background(), message(t, link.TypeSessionWindowOpen, map[string]any{
		"commandId": open, "sessionId": sessionUnderTest,
	}))
	opened := p.sent.waitFor(t, "session.windows", isSessionWindows(open)).(link.SessionWindows)
	if opened.Opened == 0 || opened.SessionID != sessionUnderTest {
		t.Fatalf("open answered %+v, want the new window named", opened)
	}
	if got := windowIndexes(opened.Windows); !slices.Equal(got, []int{0, opened.Opened}) {
		t.Fatalf("windows after open = %v, want [0 %d]", got, opened.Opened)
	}

	p.h.Message(context.Background(), message(t, link.TypeSessionWindowsList, map[string]any{
		"commandId": list, "sessionId": sessionUnderTest,
	}))
	listed := p.sent.waitFor(t, "session.windows", isSessionWindows(list)).(link.SessionWindows)
	if got := windowIndexes(listed.Windows); !slices.Equal(got, []int{0, opened.Opened}) || listed.Opened != 0 {
		t.Fatalf("listing = %v (opened %d), want [0 %d] and no window opened", got, listed.Opened, opened.Opened)
	}

	p.h.Message(context.Background(), message(t, link.TypeSessionWindowClose, map[string]any{
		"commandId": closing, "sessionId": sessionUnderTest, "window": opened.Opened,
	}))
	closed := p.sent.waitFor(t, "session.windows", isSessionWindows(closing)).(link.SessionWindows)
	if got := windowIndexes(closed.Windows); !slices.Equal(got, []int{0}) {
		t.Fatalf("windows after close = %v, want [0]", got)
	}
}

// Window 0 is the agent: closing it is refused with a code and no listing,
// and so is listing a session the host does not hold.
func TestWindowCommandsAreRefusedWithACode(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	const agent, unknown = "b1111111-1111-4111-8111-111111111111", "b2222222-2222-4222-8222-222222222222"
	p.h.Message(context.Background(), message(t, link.TypeSessionWindowClose, map[string]any{
		"commandId": agent, "sessionId": sessionUnderTest, "window": 0,
	}))
	p.h.Message(context.Background(), message(t, link.TypeSessionWindowsList, map[string]any{
		"commandId": unknown, "sessionId": "7d3e5a10-0000-4000-8000-000000000000",
	}))

	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(agent)).(link.CommandFailed); failed.Code != sessionsdomain.ErrInvalidInput.Code {
		t.Fatalf("closing window 0: code = %s, want %s", failed.Code, sessionsdomain.ErrInvalidInput.Code)
	}
	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(unknown)).(link.CommandFailed); failed.Code != sessionsdomain.ErrNotFound.Code {
		t.Fatalf("unknown session: code = %s, want %s", failed.Code, sessionsdomain.ErrNotFound.Code)
	}
	p.sent.mu.Lock()
	defer p.sent.mu.Unlock()
	for _, m := range p.sent.sent {
		if isSessionWindows(agent)(m) {
			t.Fatal("a refused close also answered with a listing")
		}
	}
}

// The hello says this runner answers window commands with the windows, so
// the control plane asks it for them.
func TestTheHelloOffersSessionWindowsList(t *testing.T) {
	if got := (&linkHandler{}).capabilities(); !slices.Contains(got, link.CapabilitySessionWindowsList) {
		t.Fatalf("capabilities = %v, missing %s", got, link.CapabilitySessionWindowsList)
	}
}

// An open that names an agent starts it in the new window and lists the
// window by the agent's catalog id, so the console's tab says what runs
// there. The regression: the field dropped on the way in, and a plain shell
// answered as if it were the agent.
func TestAWindowOpenStartsTheAgentItNames(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	session := openFolderSession(t, p)

	const open = "c1111111-1111-4111-8111-111111111111"
	p.h.Message(context.Background(), message(t, link.TypeSessionWindowOpen, map[string]any{
		"commandId": open, "sessionId": sessionUnderTest, "agent": "codex",
	}))
	opened := p.sent.waitFor(t, "session.windows", isSessionWindows(open)).(link.SessionWindows)

	named := slices.ContainsFunc(opened.Windows, func(w link.Window) bool {
		return w.Index == opened.Opened && w.Name == "codex"
	})
	if opened.Opened == 0 || !named {
		t.Fatalf("open answered %+v, want the new window named codex", opened)
	}
	if launched := p.terminals.Launches[session.Target(opened.Opened)]; launched.Dir != session.Cwd() ||
		!strings.HasPrefix(launched.Command, "codex ") {
		t.Fatalf("window %d launched %+v, want codex in %s", opened.Opened, launched, session.Cwd())
	}
}

// The blank terminal and an id outside the catalog are refused with a code
// and no listing: a window without an agent already is a shell, and an id the
// runner does not know has nothing to launch.
func TestAWindowOpenRefusesShellAndUnknownAgents(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	for commandID, agent := range map[string]string{
		"d1111111-1111-4111-8111-111111111111": "shell",
		"d2222222-2222-4222-8222-222222222222": "cursor",
	} {
		p.h.Message(context.Background(), message(t, link.TypeSessionWindowOpen, map[string]any{
			"commandId": commandID, "sessionId": sessionUnderTest, "agent": agent,
		}))
		failed := p.sent.waitFor(t, "command.failed", isCommandFailed(commandID)).(link.CommandFailed)
		if failed.Code != sessionsdomain.ErrInvalidInput.Code {
			t.Fatalf("%s: code = %s, want %s", agent, failed.Code, sessionsdomain.ErrInvalidInput.Code)
		}
	}
	windows, err := p.svc.Windows(context.Background(), sessionUnderTest)
	if err != nil || len(windows) != 1 {
		t.Fatalf("windows = %+v (err %v), want only window 0", windows, err)
	}
}

// The hello says this runner starts an agent in a window, so the control
// plane sends `agent` rather than refusing the open.
func TestTheHelloOffersSessionWindowAgent(t *testing.T) {
	if got := (&linkHandler{}).capabilities(); !slices.Contains(got, link.CapabilitySessionWindowAgent) {
		t.Fatalf("capabilities = %v, missing %s", got, link.CapabilitySessionWindowAgent)
	}
}
