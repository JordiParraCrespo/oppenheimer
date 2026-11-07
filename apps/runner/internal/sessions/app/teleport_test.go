package app_test

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// teleportedTranscripts answers the conversation Claude Code opened in each
// folder, and when it was last asked to look from.
type teleportedTranscripts struct {
	typedTranscripts
	mu     sync.Mutex
	opened map[string]string
	since  time.Time
}

func (t *teleportedTranscripts) Teleported(_ domain.Agent, dir string, since time.Time) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.since = since
	return t.opened[dir]
}

func (t *teleportedTranscripts) open(dir, conversation string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.opened[dir] = conversation
}

// A session that continues a cloud one keeps the name Claude Code gave the
// teleported conversation, which its chat, questions and status are read by.
// A restart reopens it with `--continue`, which may name it anew, so the name
// is looked for again from the restart: keeping the old one would follow a
// transcript the agent no longer writes.
func TestATeleportedSessionKeepsTheConversationItsAgentOpenedAndLooksAgainAfterARestart(t *testing.T) {
	ctx := context.Background()
	terminals := fake.NewTerminals()
	transcripts := &teleportedTranscripts{opened: map[string]string{}}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: &memoryStore{}, Publisher: &recorder{}, Files: fake.NewFiles(), Places: fake.NewPlaces(),
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer"}, Transcripts: transcripts,
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude,
		Launch: domain.Launch{Permission: "auto", Teleport: "session_01KpKLr7hb6j4zoBFARRi2ZM"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if line := terminals.Launches[session.Target(0)].Command; !strings.Contains(line, "--teleport session_01KpKLr7hb6j4zoBFARRi2ZM") {
		t.Fatalf("window 0 runs %q, want the teleport", line)
	}

	svc.FindTeleported()
	if got, _ := svc.Get(session.ID); got.Launch.Conversation != "" {
		t.Fatalf("conversation = %q before the agent wrote one", got.Launch.Conversation)
	}
	transcripts.open(session.Cwd(), "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d")
	svc.FindTeleported()
	if got, _ := svc.Get(session.ID); got.Launch.Conversation != "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" {
		t.Fatalf("conversation = %q, want the one the agent opened", got.Launch.Conversation)
	}

	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	restarted, err := svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatalf("restart: %v", err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); !strings.Contains(line, "--continue") || strings.Contains(line, "--teleport") {
		t.Fatalf("restarted window 0 runs %q, want the conversation continued", line)
	}
	if restarted.Launch.Conversation != "" {
		t.Fatalf("conversation = %q after the restart, want it looked for again", restarted.Launch.Conversation)
	}
	transcripts.open(session.Cwd(), "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e")
	svc.FindTeleported()
	if got, _ := svc.Get(session.ID); got.Launch.Conversation != "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e" {
		t.Fatalf("conversation = %q, want the one the restart opened", got.Launch.Conversation)
	}
	if !transcripts.since.After(session.Created) {
		t.Fatalf("looked from %v, want from the restart, after %v", transcripts.since, session.Created)
	}
}
