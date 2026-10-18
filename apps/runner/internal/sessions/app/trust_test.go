package app_test

import (
	"context"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

type recordedTrust struct{ dirs []string }

func (r *recordedTrust) Trust(_ domain.Agent, dir string) error {
	r.dirs = append(r.dirs, dir)
	return nil
}

// A launch nobody approves (a bot's session, a review) must find its folder
// already trusted, or Claude Code stops on "do you trust this folder?" in a
// terminal no one is watching. A launch at `ask` keeps that question.
func TestCreateTrustsTheFolderOnlyForALaunchWithoutApprovals(t *testing.T) {
	for _, tc := range []struct {
		permission string
		trusted    bool
	}{{"auto", true}, {"full", true}, {"ask", false}} {
		t.Run(tc.permission, func(t *testing.T) {
			trust := &recordedTrust{}
			svc, err := app.New(app.Options{
				Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
				Store: &memoryStore{}, Places: fake.NewPlaces(), Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
				Trust: trust,
			})
			if err != nil {
				t.Fatal(err)
			}
			in := createInput()
			in.Launch.Permission = tc.permission

			session, err := svc.Create(context.Background(), in)
			if err != nil {
				t.Fatalf("create: %v", err)
			}

			if !tc.trusted {
				if len(trust.dirs) != 0 {
					t.Fatalf("trusted %v for a launch that asks", trust.dirs)
				}
				return
			}
			if len(trust.dirs) != 1 || trust.dirs[0] != session.Cwd() {
				t.Fatalf("trusted %v, want [%s]", trust.dirs, session.Cwd())
			}
		})
	}
}
