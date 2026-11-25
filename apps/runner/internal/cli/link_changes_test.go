package cli

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func isSessionChanges(commandID string) func(any) bool {
	return func(m any) bool {
		reply, ok := m.(link.SessionChanges)
		return ok && reply.CommandID == commandID
	}
}

// A read answers under its command with the session's checkouts as arrays,
// never null, which the control plane refuses: a folder session has none.
// A session the host does not hold is SESS_001.
func TestAChangesReadAnswersWithTheCheckoutsOrACode(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	const read, unknown = "d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222"
	p.h.Message(context.Background(), message(t, link.TypeSessionChangesRead, map[string]any{
		"commandId": read, "sessionId": sessionUnderTest, "scope": "uncommitted",
	}))
	p.h.Message(context.Background(), message(t, link.TypeSessionChangesRead, map[string]any{
		"commandId": unknown, "sessionId": "7d3e5a10-0000-4000-8000-000000000000", "scope": "base",
	}))

	answer := p.sent.waitFor(t, "session.changes", isSessionChanges(read)).(link.SessionChanges)
	if answer.SessionID != sessionUnderTest || answer.Scope != "uncommitted" {
		t.Fatalf("answered %+v", answer)
	}
	if encoded, _ := json.Marshal(answer); !strings.Contains(string(encoded), `"checkouts":[]`) {
		t.Fatalf("checkouts sent as %s, want []", encoded)
	}
	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(unknown)).(link.CommandFailed); failed.Code != sessionsdomain.ErrNotFound.Code {
		t.Fatalf("unknown session: code = %s, want %s", failed.Code, sessionsdomain.ErrNotFound.Code)
	}
}

// The hello says this runner reads a session's changes, so the control plane
// asks it for them; without the capability it is never asked.
func TestTheHelloOffersSessionChangesRead(t *testing.T) {
	if got := (&linkHandler{}).capabilities(); !slices.Contains(got, link.CapabilitySessionChangesRead) {
		t.Fatalf("capabilities = %v, missing %s", got, link.CapabilitySessionChangesRead)
	}
}
