package cli

import (
	"context"
	"slices"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// fakePrompter is the CLI as `claude -p --cloud` answers: what it was sent,
// and the refusal the test sets.
type fakePrompter struct {
	mu     sync.Mutex
	sent   [][2]string
	refuse error
}

func (f *fakePrompter) Prompt(_ context.Context, id, text string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, [2]string{id, text})
	return f.refuse
}

// The regression this guards: a host that does not offer to wake a cloud
// session, sends the reply to a session other than the one named, or answers
// nothing (so the control plane waits out its timeout with the reply held)
// instead of `session.cloud.prompted` or the CLI's refusal with its code.
func TestACloudPromptIsSentWithTheCLIAndAnswered(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	prompter := &fakePrompter{}
	p.h.app.CloudPrompt = prompter
	prompt := func(commandID string) {
		p.h.Message(context.Background(), message(t, link.TypeSessionCloudPrompt, map[string]any{
			"commandId": commandID, "sessionId": sessionUnderTest,
			"cloudSessionId": "session_014a8EH8DJs95X1iK8ZH9Y82", "text": "Yes, add the test too.",
		}))
	}
	const taken, refused = "33333333-0000-4000-8000-000000000001", "33333333-0000-4000-8000-000000000002"

	prompt(taken)
	p.sent.waitFor(t, "session.cloud.prompted", func(m any) bool {
		got, ok := m.(link.SessionCloudPrompted)
		return ok && got.CommandID == taken
	})
	prompter.mu.Lock()
	sent := slices.Clone(prompter.sent)
	prompter.refuse = sessionsdomain.ErrCloudSignIn.WithDetail("run claude auth login")
	prompter.mu.Unlock()
	if len(sent) != 1 || sent[0] != [2]string{"session_014a8EH8DJs95X1iK8ZH9Y82", "Yes, add the test too."} {
		t.Fatalf("sent = %v", sent)
	}

	prompt(refused)
	if failed := p.sent.waitFor(t, "command.failed", isCommandFailed(refused)).(link.CommandFailed); failed.Code != sessionsdomain.ErrCloudSignIn.Code {
		t.Fatalf("not signed in: code = %s", failed.Code)
	}

	if !slices.Contains((&linkHandler{}).capabilities(), link.CapabilitySessionCloudPrompt) {
		t.Fatal("the hello does not offer session.cloud.prompt")
	}
}
