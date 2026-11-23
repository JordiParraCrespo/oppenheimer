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

// A Codex session is told where its note is and given the runner's tools on
// every launch, a restart included: both are this host's and never saved, so
// a launch path that forgot them would start an agent that knows nothing of
// Oppenheimer.
func TestACodexSessionIsBriefedWhenCreatedAndWhenRestarted(t *testing.T) {
	ctx := context.Background()
	terminals := fake.NewTerminals()
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: &memoryStore{}, Publisher: &recorder{}, Files: fake.NewFiles(), Places: fake.NewPlaces(),
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer"}, Tools: []string{"runner", "mcp"},
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentCodex, Launch: domain.Launch{Prompt: "fix it"},
	})
	if err != nil {
		t.Fatal(err)
	}
	briefed := func(line string) bool {
		return strings.Contains(line, session.Note()) && strings.Contains(line, "mcp_servers.oppenheimer.command=")
	}
	if line := terminals.Launches[session.Target(0)].Command; !briefed(line) {
		t.Fatalf("window 0 runs %q, want the note and the tools", line)
	}
	if got, _ := svc.Get(session.ID); got.Launch.Note != "" || got.Launch.Tools != nil {
		t.Fatalf("the briefing was saved with the session: %+v", got.Launch)
	}
	if _, err := svc.Stop(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	restarted, err := svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if line := terminals.CommandOf(restarted.TmuxName()); !briefed(line) {
		t.Fatalf("restarted window 0 runs %q, want the note and the tools", line)
	}
}
