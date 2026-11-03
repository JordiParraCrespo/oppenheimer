package app_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// waking records what a linked publisher was asked to wake.
type waking struct {
	app.NopPublisher
	wakes []domain.WakeRequest
}

func (w *waking) WakeRequested(_ string, wake domain.WakeRequest) {
	w.wakes = append(w.wakes, wake)
}

// The regression this guards: a wake whose time is the runner's local time
// without a zone, read by the control plane hours off, or one set so far
// out (or so soon) that the agent never sees it.
func TestAWakeIsATimeInUTCWithinAWeek(t *testing.T) {
	ctx := context.Background()
	svc, err := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: fake.NewPlaces(), Layout: domain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(ctx, app.CreateInput{Repo: "acme/xrp-mobile", BaseBranch: "main", Agent: domain.AgentClaude})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 2, 21, 0, 0, 0, time.FixedZone("CET", 3600))

	if _, err := svc.WakeLater(session.ID, 30*time.Minute, "check", now); !isProblem(err, domain.ErrNoLink) {
		t.Fatalf("with no link: %v", err)
	}
	link := &waking{}
	svc.SetPublisher(link)
	wake, err := svc.WakeLater(session.ID, 30*time.Minute, "  Check the deploy.  ", now)
	if err != nil {
		t.Fatal(err)
	}
	if wake.At != "2026-11-02T20:30:00Z" || wake.Text != "Check the deploy." || wake.ID == "" {
		t.Fatalf("wake %+v", wake)
	}
	if len(link.wakes) != 1 || link.wakes[0] != wake {
		t.Fatalf("logged %+v", link.wakes)
	}

	for name, try := range map[string]func() error{
		"too soon": func() error { _, err := svc.WakeLater(session.ID, 30*time.Second, "x", now); return err },
		"too far":  func() error { _, err := svc.WakeLater(session.ID, 8*24*time.Hour, "x", now); return err },
		"no note":  func() error { _, err := svc.WakeLater(session.ID, time.Hour, " ", now); return err },
		"an essay": func() error {
			_, err := svc.WakeLater(session.ID, time.Hour, strings.Repeat("x", 1001), now)
			return err
		},
	} {
		if err := try(); !isProblem(err, domain.ErrInvalidInput) {
			t.Fatalf("%s: %v", name, err)
		}
	}
}
