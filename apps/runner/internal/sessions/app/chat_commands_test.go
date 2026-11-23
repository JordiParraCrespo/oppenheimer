package app_test

import (
	"context"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// replayedTranscripts follows a conversation as a reset and one live batch.
type replayedTranscripts struct{ typedTranscripts }

func (*replayedTranscripts) Follow(_ context.Context, _ domain.Session, _, _ int, _ <-chan int64, emit func(app.ChatBatch) error) error {
	if err := emit(app.ChatBatch{Reset: true, History: app.HistoryEnd}); err != nil {
		return err
	}
	return emit(app.ChatBatch{Entries: []string{`{"type":"user"}`}})
}

// folderCommands answers one command for any folder, and records the folder.
type folderCommands struct{ asked []string }

func (c *folderCommands) InFolder(dir string, _ int) []domain.SlashCommand {
	c.asked = append(c.asked, dir)
	return []domain.SlashCommand{{Name: "recap", Kind: domain.SlashCommandSkill}}
}

// The chat composer's `/` menu learns the project's commands from the batch
// that starts the chat over: a reconnect lists them again, a live batch does
// not repeat them, and an agent whose commands the runner does not read
// sends none rather than Claude Code's.
func TestTheProjectsCommandsRideTheChatsReset(t *testing.T) {
	for _, tc := range []struct {
		agent domain.Agent
		want  int
	}{{domain.AgentClaude, 1}, {domain.AgentCodex, 0}} {
		t.Run(string(tc.agent), func(t *testing.T) {
			h := newPromptHarness(t, state.New(t.TempDir()), &promptRecorder{})
			session, err := h.svc.Create(context.Background(), app.CreateInput{
				Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: tc.agent,
			})
			if err != nil {
				t.Fatal(err)
			}
			commands := &folderCommands{}
			conversations := app.NewConversations(app.ConversationsOptions{
				Sessions: h.svc, Transcripts: &replayedTranscripts{}, Commands: commands,
			})
			var batches []app.ChatBatch
			err = conversations.FollowChat(context.Background(), session.ID, 1024, 16, 200, nil, func(batch app.ChatBatch) error {
				batches = append(batches, batch)
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			if len(batches) != 2 || len(batches[0].Commands) != tc.want || batches[1].Commands != nil {
				t.Fatalf("batches = %+v, want %d commands on the reset alone", batches, tc.want)
			}
			if tc.want > 0 && (len(commands.asked) != 1 || commands.asked[0] != session.Cwd()) {
				t.Fatalf("asked %v, want the folder the agent runs in, %q", commands.asked, session.Cwd())
			}
		})
	}
}
