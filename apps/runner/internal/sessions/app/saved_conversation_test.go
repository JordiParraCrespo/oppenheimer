package app_test

import (
	"context"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// savedTranscripts answers whether the agent has written each conversation
// down, and counts the asks.
type savedTranscripts struct {
	typedTranscripts
	saved map[string]domain.Saving
	asked int
}

func (t *savedTranscripts) SavedConversation(session domain.Session) domain.Saving {
	t.asked++
	return t.saved[session.Launch.Conversation]
}

// A Restart asks the transcripts whether Qwen wrote the session's
// conversation: once it has, the restart reopens it by id, since another
// Qwen in the same folder makes "the newest" possibly the other's; before
// that, `--resume <id>` would exit, so the conversation is created again
// under the same id. Regression: a restart that resumed "the newest here"
// in a shared folder, or one that named a conversation Qwen never wrote and
// came back with no agent.
func TestARestartAsksWhetherTheConversationWasSaved(t *testing.T) {
	for _, tc := range []struct {
		name  string
		saved domain.Saving
		want  string
	}{
		{"saved", domain.Saved, "--resume " + conversation},
		{"not yet saved", domain.NotSaved, "--session-id " + conversation},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			terminals := fake.NewTerminals()
			transcripts := &savedTranscripts{saved: map[string]domain.Saving{conversation: tc.saved}}
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
				BaseBranch: "main", Agent: domain.AgentQwen, Launch: domain.Launch{Permission: "ask", Conversation: conversation},
			})
			if err != nil {
				t.Fatalf("create: %v", err)
			}
			if _, err := svc.Stop(ctx, session.ID); err != nil {
				t.Fatal(err)
			}
			restarted, err := svc.Restart(ctx, session.ID)
			if err != nil {
				t.Fatalf("restart: %v", err)
			}
			line := terminals.CommandOf(restarted.TmuxName())
			if !strings.HasSuffix(line, tc.want) || transcripts.asked == 0 {
				t.Fatalf("restarted window 0 runs %q (asked %d times), want it to end on %q", line, transcripts.asked, tc.want)
			}
		})
	}
}
