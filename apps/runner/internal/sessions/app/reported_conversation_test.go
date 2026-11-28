package app_test

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// reportedTranscripts answers the conversation each session's agent last
// said it is in.
type reportedTranscripts struct {
	typedTranscripts
	mu  sync.Mutex
	now map[string]string
}

func (t *reportedTranscripts) CurrentConversation(session domain.Session) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.now[session.ID]
}

func (t *reportedTranscripts) report(session, conversation string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.now[session] = conversation
}

func newConversationService(t *testing.T) (*app.Service, *fake.Terminals, *reportedTranscripts) {
	t.Helper()
	return newConversationServiceWith(t, nil)
}

func newConversationServiceWith(t *testing.T, remoteControl func() bool) (*app.Service, *fake.Terminals, *reportedTranscripts) {
	t.Helper()
	terminals := fake.NewTerminals()
	transcripts := &reportedTranscripts{now: map[string]string{}}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: &memoryStore{}, Publisher: &recorder{}, Files: fake.NewFiles(), Places: fake.NewPlaces(),
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer"}, Transcripts: transcripts,
		StatusLine: func(session string) string {
			if session == "" {
				return "'/opt/runner' statusline"
			}
			return "'/opt/runner' statusline --session " + session
		},
		RemoteControl: remoteControl,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, terminals, transcripts
}

func openClaudeSession(t *testing.T, svc *app.Service) domain.Session {
	t.Helper()
	session, err := svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude, Launch: domain.Launch{Permission: "auto", Conversation: conversation},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

// `/clear` or `/resume` in the pane moves Claude Code to a conversation of
// another name. The session keeps the one its agent reports, so a Restart
// resumes the conversation the person is in; resuming the one it launched
// in dropped their current work for an old one.
func TestASessionKeepsTheConversationItsAgentReportsAndARestartResumesIt(t *testing.T) {
	ctx := context.Background()
	svc, terminals, transcripts := newConversationService(t)
	session := openClaudeSession(t, svc)
	if line := terminals.Launches[session.Target(0)].Command; !strings.Contains(line, "--session-id "+conversation) {
		t.Fatalf("window 0 runs %q, want the launch conversation named", line)
	}

	const cleared = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
	transcripts.report(session.ID, cleared)
	svc.FindReportedConversations()
	if got, _ := svc.Get(session.ID); got.Launch.Conversation != cleared {
		t.Fatalf("conversation = %q, want the one the agent reported", got.Launch.Conversation)
	}

	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	restarted, err := svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatalf("restart: %v", err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); !strings.Contains(line, "--resume "+cleared) {
		t.Fatalf("restarted window 0 runs %q, want the reported conversation resumed", line)
	}
}

// A report the poll loop has not kept yet still decides what a Restart
// resumes: the agent may have moved on just before it stopped.
func TestARestartResumesAConversationReportedSinceTheLastPoll(t *testing.T) {
	ctx := context.Background()
	svc, terminals, transcripts := newConversationService(t)
	session := openClaudeSession(t, svc)
	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	const resumed = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"
	transcripts.report(session.ID, resumed)
	restarted, err := svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatalf("restart: %v", err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); !strings.Contains(line, "--resume "+resumed) {
		t.Fatalf("restarted window 0 runs %q, want the reported conversation resumed", line)
	}
	if restarted.Launch.Conversation != resumed {
		t.Fatalf("conversation = %q after the restart, want %q kept", restarted.Launch.Conversation, resumed)
	}
}

// Only window 0's agent reports which conversation the session is in: a
// second Claude Code in another window shares the session's environment, and
// reporting through it would take the session's chat over.
func TestOnlyWindowZerosStatusLineNamesTheSession(t *testing.T) {
	svc, terminals, _ := newConversationService(t)
	session := openClaudeSession(t, svc)
	if line := terminals.Launches[session.Target(0)].Command; !strings.Contains(line, "statusline --session "+session.ID) {
		t.Fatalf("window 0 runs %q, want its status line to name the session", line)
	}
	window, err := svc.OpenWindow(context.Background(), session.ID, app.WindowInput{Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	line := terminals.Launches[session.Target(window.Index)].Command
	if !strings.Contains(line, "statusline") || strings.Contains(line, "--session") {
		t.Fatalf("window %d runs %q, want a status line that names no session", window.Index, line)
	}
}

// The host's Remote Control switch is read at each launch of window 0, the
// first and every restart, so turning it on reaches a session at its next
// start and off takes it away again; it never reaches another window's
// agent, which would register a second session under the same name. The
// regression: the switch saved into the session's launch and outliving
// `runner remote-control off`, or read once at startup.
func TestRemoteControlFollowsTheHostsSwitchAtEachLaunchOfWindowZero(t *testing.T) {
	ctx := context.Background()
	on := false
	svc, terminals, _ := newConversationServiceWith(t, func() bool { return on })
	session := openClaudeSession(t, svc)
	if line := terminals.Launches[session.Target(0)].Command; strings.Contains(line, "--remote-control") {
		t.Fatalf("switched off, window 0 runs %q", line)
	}

	on = true
	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	restarted, err := svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); !strings.Contains(line, "--remote-control "+session.Name) {
		t.Fatalf("switched on, the restart runs %q, want Remote Control named after the session", line)
	}
	window, err := svc.OpenWindow(ctx, session.ID, app.WindowInput{Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	if line := terminals.Launches[session.Target(window.Index)].Command; strings.Contains(line, "--remote-control") {
		t.Fatalf("window %d runs %q", window.Index, line)
	}

	on = false
	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	restarted, err = svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); strings.Contains(line, "--remote-control") {
		t.Fatalf("switched off again, the restart runs %q", line)
	}
}
