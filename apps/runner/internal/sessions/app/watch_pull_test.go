package app_test

import (
	"context"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// watching records what a linked publisher was asked to watch.
type watching struct {
	app.NopPublisher
	watches []domain.PullWatch
}

func (w *watching) PullWatched(_ string, watch domain.PullWatch) {
	w.watches = append(w.watches, watch)
}

// The regression this guards: a watch logged under a repository the control
// plane cannot match a webhook to (a name, or none), so the agent waits to
// be woken by events that never reach it.
func TestAWatchNamesTheCheckoutsGithubRepository(t *testing.T) {
	ctx := context.Background()
	svc, err := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: fake.NewPlaces(), Layout: domain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	linked, err := svc.Create(ctx, app.CreateInput{
		Repo: "acme/xrp-mobile", BaseBranch: "main", Agent: domain.AgentClaude, GithubRepoID: 821374923,
	})
	if err != nil {
		t.Fatal(err)
	}
	local, err := svc.Create(ctx, app.CreateInput{Repo: "acme/other", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := svc.WatchPull(linked.ID, "", 128, true); !isProblem(err, domain.ErrNoLink) {
		t.Fatalf("with no link: %v", err)
	}
	link := &watching{}
	svc.SetPublisher(link)
	if _, err := svc.WatchPull(linked.ID, "", 128, true); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.WatchPull(linked.ID, "acme/xrp-mobile", 128, false); err != nil {
		t.Fatal(err)
	}
	want := []domain.PullWatch{
		{GithubRepoID: "821374923", Number: 128, Watch: true},
		{GithubRepoID: "821374923", Number: 128, Watch: false},
	}
	if len(link.watches) != 2 || link.watches[0] != want[0] || link.watches[1] != want[1] {
		t.Fatalf("watched %+v", link.watches)
	}

	for name, try := range map[string]func() error{
		"a checkout the session lacks":   func() error { _, err := svc.WatchPull(linked.ID, "acme/nope", 1, true); return err },
		"no number":                      func() error { _, err := svc.WatchPull(linked.ID, "", 0, true); return err },
		"a repository with no GitHub id": func() error { _, err := svc.WatchPull(local.ID, "", 1, true); return err },
	} {
		if err := try(); !isProblem(err, domain.ErrInvalidInput) {
			t.Fatalf("%s: %v", name, err)
		}
	}
}
