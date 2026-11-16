package cli

import (
	"context"
	"slices"
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
