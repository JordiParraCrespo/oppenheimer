package app_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// told records what a linked publisher was asked to tell the person.
type told struct {
	app.NopPublisher
	notices map[string][]domain.Notice
}

func (t *told) Notified(sessionID string, notice domain.Notice) {
	t.notices[sessionID] = append(t.notices[sessionID], notice)
}

func isProblem(err error, want *problem.Error) bool {
	var got *problem.Error
	return errors.As(err, &got) && got.Code == want.Code
}

// The regression this guards: a notice that never leaves the host (a
// publisher that drops it) reported to the agent as sent, so the agent
// believes the person heard and stops.
func TestANoticeReachesTheLinkOrIsRefused(t *testing.T) {
	ctx := context.Background()
	svc, err := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: fake.NewPlaces(), Layout: domain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(ctx, app.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := svc.Notify(session.ID, "Tests pass."); !isProblem(err, domain.ErrNotify) {
		t.Fatalf("with no link: %v", err)
	}

	link := &told{notices: map[string][]domain.Notice{}}
	svc.SetPublisher(link)
	first, err := svc.Notify(session.ID, "  Tests pass.  ")
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.Notify(session.ID, "Deployed.")
	if err != nil {
		t.Fatal(err)
	}
	got := link.notices[session.ID]
	if len(got) != 2 || got[0].Text != "Tests pass." || first.ID == "" || first.ID == second.ID {
		t.Fatalf("told %+v", got)
	}

	if _, err := svc.Notify(session.ID, strings.Repeat("x", domain.NoticeMaxBytes+1)); !isProblem(err, domain.ErrInvalidInput) {
		t.Fatalf("an essay: %v", err)
	}
	if _, err := svc.Notify(session.ID, "   "); !isProblem(err, domain.ErrInvalidInput) {
		t.Fatalf("no words: %v", err)
	}
	if _, err := svc.Notify("nosuchsession", "hi"); !isProblem(err, domain.ErrNotFound) {
		t.Fatalf("no session: %v", err)
	}
}
