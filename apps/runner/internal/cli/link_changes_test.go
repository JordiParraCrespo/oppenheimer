package cli

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
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

// An answer whose patches fit the read's bounds in raw bytes can still pass
// the link's frame once encoded: JSON writes `<` as six bytes. It is fitted
// before it is sent, patches left out from the end first, then files,
// counted; the regression is a frame the link refuses, which the control
// plane waits out until it times out.
func TestAnAnswerIsFittedToTheFrameAsItIsEncoded(t *testing.T) {
	jsx := strings.Repeat("<", 60<<10)
	files := make([]link.ChangedFile, 0, 8)
	for range 8 {
		files = append(files, link.ChangedFile{Path: "page.tsx", Status: "modified", Additions: 1, Patch: jsx})
	}
	answer := link.SessionChanges{
		Type: link.TypeSessionChanges, CommandID: "c", SessionID: "s", Scope: "base",
		Checkouts: []link.CheckoutChanges{{Repo: "acme/web", Files: files}},
	}
	const limit = 512 << 10
	fitted := fitFrame(answer, limit)
	body, _ := json.Marshal(fitted)
	if len(body) > limit {
		t.Fatalf("fitted answer is %d bytes, over %d", len(body), limit)
	}
	kept := fitted.Checkouts[0].Files
	if len(kept) != 8 || kept[0].Patch == "" || !kept[7].PatchOmitted || kept[7].Patch != "" {
		t.Fatalf("want every file kept, the first patch kept and the last left out; got %d files", len(kept))
	}

	long := strings.Repeat("d/", 2000) + "f.go"
	many := make([]link.ChangedFile, 0, 500)
	for range 500 {
		many = append(many, link.ChangedFile{Path: long, Status: "added"})
	}
	crowded := fitFrame(link.SessionChanges{Checkouts: []link.CheckoutChanges{{Files: many}}}, limit)
	if body, _ := json.Marshal(crowded); len(body) > limit {
		t.Fatalf("crowded answer is %d bytes", len(body))
	}
	if c := crowded.Checkouts[0]; c.OmittedFiles == 0 || len(c.Files)+c.OmittedFiles != 500 {
		t.Fatalf("files %d + omitted %d; want the cut counted", len(c.Files), c.OmittedFiles)
	}
}

// A read's time runs from when it reached the runner, not from when it left
// the lane reads queue on: the control plane's wait started when it sent it.
// One whose time ran out in the queue is dropped, unread and unanswered,
// so a backlog drains instead of running git for readers that left. The
// regression: two slow reads, the second timing out at the API while the
// runner, its clock not yet started, read on regardless.
func TestAChangesReadWhoseTimeRanOutInTheQueueIsDropped(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	const stale, fresh = "e1111111-1111-4111-8111-111111111111", "e2222222-2222-4222-8222-222222222222"
	long := time.Now().Add(-sessionsapp.ChangesReadTime - time.Second)
	p.h.changesRead(context.Background(), long, link.SessionChangesRead{
		Type: link.TypeSessionChangesRead, CommandID: stale, SessionID: sessionUnderTest, Scope: "base",
	})
	p.h.changesRead(context.Background(), time.Now(), link.SessionChangesRead{
		Type: link.TypeSessionChangesRead, CommandID: fresh, SessionID: sessionUnderTest, Scope: "base",
	})
	p.sent.waitFor(t, "session.changes", isSessionChanges(fresh))

	p.sent.mu.Lock()
	defer p.sent.mu.Unlock()
	for _, m := range p.sent.sent {
		if isSessionChanges(stale)(m) || isCommandFailed(stale)(m) {
			t.Fatalf("a read past its time was answered: %+v", m)
		}
	}
}
