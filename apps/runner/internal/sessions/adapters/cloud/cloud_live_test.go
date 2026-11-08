package cloud

import (
	"context"
	"os"
	"strings"
	"testing"
)

// TestLiveStartWithTheRealCLI starts a real cloud session with this machine's
// own `claude`, signed in to claude.ai, from a checkout of a GitHub repository
// the account can reach. It is opt-in: it creates a session on that account.
//
//	OPPENHEIMER_CLOUD_LIVE_DIR=/path/to/a/checkout go test -run Live ./internal/sessions/adapters/cloud/
func TestLiveStartWithTheRealCLI(t *testing.T) {
	dir := os.Getenv("OPPENHEIMER_CLOUD_LIVE_DIR")
	if dir == "" {
		t.Skip("set OPPENHEIMER_CLOUD_LIVE_DIR to a checkout to start a real cloud session")
	}
	started, err := Starter{}.Start(context.Background(), dir,
		"Oppenheimer runner live test: reply with the single word OK and change nothing.")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if !strings.HasPrefix(started.ID, "session_") || started.URL != "https://claude.ai/code/"+started.ID {
		t.Fatalf("started = %+v", started)
	}
	t.Logf("started %s (%q) at %s", started.ID, started.Title, started.URL)
}

// TestLivePromptWithTheRealCLI sends a message to a real cloud session with
// this machine's own `claude`, signed in to the claude.ai account that owns
// it. It is opt-in: it wakes that session.
//
//	OPPENHEIMER_CLOUD_LIVE_SESSION=session_… go test -run LivePrompt ./internal/sessions/adapters/cloud/
func TestLivePromptWithTheRealCLI(t *testing.T) {
	id := os.Getenv("OPPENHEIMER_CLOUD_LIVE_SESSION")
	if id == "" {
		t.Skip("set OPPENHEIMER_CLOUD_LIVE_SESSION to a cloud session to send it a message")
	}
	if err := (Prompter{}).Prompt(context.Background(), id,
		"Oppenheimer runner live test: reply with the single word OK and change nothing."); err != nil {
		t.Fatalf("Prompt: %v", err)
	}
}
