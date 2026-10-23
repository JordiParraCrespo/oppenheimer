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

// Every launch must find its folder already trusted, whatever its permission
// level, or Claude Code opens on "do you trust this folder?" for a folder the
// runner made for it (and stops there in a terminal no one is watching).
func TestCreateTrustsTheFolderAtEveryPermission(t *testing.T) {
	for _, permission := range []string{"auto", "full", "ask"} {
		t.Run(permission, func(t *testing.T) {
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
			in.Launch.Permission = permission

			session, err := svc.Create(context.Background(), in)
			if err != nil {
				t.Fatalf("create: %v", err)
			}

			if len(trust.dirs) != 1 || trust.dirs[0] != session.Cwd() {
				t.Fatalf("trusted %v, want [%s]", trust.dirs, session.Cwd())
			}
		})
	}
}
