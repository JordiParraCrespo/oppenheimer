package cli

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const watchUnderTest = "6f1c1f9e-0b5d-4c38-9a4e-1f0d6c1b2a01"

// openFolderSession starts a folder session through the link and waits for it.
func openFolderSession(t *testing.T, p *placesHarness) sessionsdomain.Session {
	t.Helper()
	p.places.SetFolder("/home/jordi/code/site", true)
	p.h.Message(context.Background(), message(t, "session.create", map[string]any{
		"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": "shell",
		"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "site",
		"folder": "/home/jordi/code/site", "checkouts": []any{}, "cwdCheckoutId": nil,
	}))
	return waitForState(t, p.svc, sessionsdomain.StateStarting)
}

// A watch sent over the link reports `terminal.matched` with the watch and a
// count, and nothing of what the screen said.
func TestASessionWatchReportsCountsAndNeverTheText(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	session := openFolderSession(t, p)
	p.svc.SetPublisher(p.h)
	p.h.Message(context.Background(), message(t, link.TypeSessionWatch, map[string]any{
		"commandId": "22222222-2222-4222-8222-222222222222", "sessionId": sessionUnderTest,
		"watchId": watchUnderTest, "pattern": `secret-token-\d+`,
	}))
	p.terminals.Screens[session.Target(0)] = "$ echo\nsecret-token-42\nsecret-token-43\n"

	// The watch is applied on the session's lane: poll until a pass reports.
	var payloads []string
	for deadline := time.Now().Add(2 * time.Second); len(payloads) == 0 && time.Now().Before(deadline); {
		if _, err := p.svc.RefreshAll(context.Background()); err != nil {
			t.Fatal(err)
		}
		for _, event := range p.events(sessionUnderTest) {
			if strings.Contains(event.Payload, "secret-token") {
				t.Fatalf("screen text left the host in %s: %s", event.Kind, event.Payload)
			}
			if event.Kind == sessionsdomain.TerminalMatchedKind {
				payloads = append(payloads, event.Payload)
			}
		}
		time.Sleep(time.Millisecond)
	}
	if len(payloads) != 1 {
		t.Fatalf("terminal.matched sent %d times, want once", len(payloads))
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(payloads[0]), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got["watchId"] != watchUnderTest || got["count"] != float64(2) {
		t.Fatalf("payload = %v, want {watchId, count: 2}", got)
	}
}

// An invalid pattern answers INVALID_PATTERN, a session the host does not
// know the same code as any other command for one, and an unwatch nothing.
func TestASessionWatchIsRefusedWithACode(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	const badPattern, unknownSession, unwatch = "33333333-3333-4333-8333-333333333333",
		"44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"
	p.h.Message(context.Background(), message(t, link.TypeSessionWatch, map[string]any{
		"commandId": badPattern, "sessionId": sessionUnderTest, "watchId": watchUnderTest, "pattern": `(unclosed`,
	}))
	// The unwatch first, on the lane the next watch takes: once that one
	// has answered, the unwatch has run.
	p.h.Message(context.Background(), message(t, link.TypeSessionUnwatch, map[string]any{
		"commandId": unwatch, "sessionId": "7d3e5a10-0000-4000-8000-000000000000", "watchId": watchUnderTest,
	}))
	p.h.Message(context.Background(), message(t, link.TypeSessionWatch, map[string]any{
		"commandId": unknownSession, "sessionId": "7d3e5a10-0000-4000-8000-000000000000",
		"watchId": watchUnderTest, "pattern": `ok`,
	}))

	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(badPattern)).(link.CommandFailed); failed.Code != "INVALID_PATTERN" {
		t.Fatalf("bad pattern: code = %s, want INVALID_PATTERN", failed.Code)
	}
	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(unknownSession)).(link.CommandFailed); failed.Code != sessionsdomain.ErrNotFound.Code {
		t.Fatalf("unknown session: code = %s, want %s", failed.Code, sessionsdomain.ErrNotFound.Code)
	}
	p.sent.mu.Lock()
	defer p.sent.mu.Unlock()
	for _, m := range p.sent.sent {
		if isCommandFailed(unwatch)(m) {
			t.Fatal("an unwatch failed")
		}
	}
}

// The hello says this runner takes terminal watches.
func TestTheHelloOffersSessionWatch(t *testing.T) {
	if got := (&linkHandler{}).capabilities(); !slices.Contains(got, link.CapabilitySessionWatch) {
		t.Fatalf("capabilities = %v, missing %s", got, link.CapabilitySessionWatch)
	}
}
