package cli

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The regression this guards: a host that answers `transcript.read` for a
// session it does not hold, answers an agent with no transcript with an
// empty page a bot reads as a silent session, answers nothing so the
// control plane waits out its timeout, or does not offer the read at all.
func TestATranscriptReadIsAnsweredWithAPageOrWhyNot(t *testing.T) {
	projects := t.TempDir()
	dir := filepath.Join(projects, "-home-jordi-code-site")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	lines := strings.Join([]string{
		`{"type":"user","uuid":"p0","message":{"role":"user","content":"Fix the picker"}}`,
		`{"type":"assistant","uuid":"a0","message":{"role":"assistant","content":[{"type":"text","text":"Done."}]}}`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(dir, sessionUnderTest+".jsonl"), []byte(lines), 0o600); err != nil {
		t.Fatal(err)
	}
	reader := transcript.New(transcript.Options{ClaudeProjects: projects})
	p := newPlacesHarnessReading(t, t.TempDir(), "acct", reader)

	read := func(p *placesHarness, commandID, sessionID string) {
		p.h.Message(context.Background(), message(t, link.TypeTranscriptRead, map[string]any{
			"commandId": commandID, "sessionId": sessionID, "limit": 500,
		}))
	}
	create := func(p *placesHarness, agent string) {
		p.places.SetFolder("/home/jordi/code/site", true)
		p.h.Message(context.Background(), message(t, "session.create", map[string]any{
			"commandId": "11111111-1111-4111-8111-111111111111", "sessionId": sessionUnderTest, "agent": agent,
			"workspaceId": "ws", "organizationSlug": "acme", "sessionSlug": "site",
			"folder": "/home/jordi/code/site", "checkouts": []any{}, "cwdCheckoutId": nil,
			// The control plane names the conversation after the session.
			"launch": map[string]any{"conversation": sessionUnderTest},
		}))
		waitForState(t, p.svc, sessionsdomain.StateStarting)
	}
	const page, elsewhere, shell = "22222222-0000-4000-8000-000000000001",
		"22222222-0000-4000-8000-000000000002", "22222222-0000-4000-8000-000000000003"

	create(p, "claude-code")
	read(p, page, sessionUnderTest)
	read(p, elsewhere, "7d3e5a10-0000-4000-8000-000000000000")
	got := p.sent.waitFor(t, "transcript.page", func(m any) bool {
		got, ok := m.(link.TranscriptPage)
		return ok && got.CommandID == page
	}).(link.TranscriptPage)
	if len(got.Entries) != 2 || !got.AtEnd || got.Conversation == "" || got.Next != int64(len(lines)) {
		t.Fatalf("page = %+v", got)
	}
	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(elsewhere)).(link.CommandFailed); failed.Code != sessionsdomain.ErrNotFound.Code {
		t.Fatalf("a session elsewhere: code = %s", failed.Code)
	}

	other := newPlacesHarnessReading(t, t.TempDir(), "acct", reader)
	create(other, "shell")
	read(other, shell, sessionUnderTest)
	if failed := other.sent.waitFor(t, "command.failed", isCommandFailed(shell)).(link.CommandFailed); failed.Code != sessionsdomain.ErrNoTranscript.Code {
		t.Fatalf("a shell session: code = %s", failed.Code)
	}

	if !slices.Contains((&linkHandler{}).capabilities(), link.CapabilityTranscriptRead) {
		t.Fatal("the hello does not offer transcript.read")
	}
}
