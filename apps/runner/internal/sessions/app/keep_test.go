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

// A kept session comes back on its own after a reboot; nothing else does
// (`product/research/lessons-from-herdr.md`).

// savedMap is the session map as the runner left it before the host went down.
type savedMap struct{ sessions []domain.Session }

func (m *savedMap) Load() ([]domain.Session, error) { return m.sessions, nil }
func (m *savedMap) Save([]domain.Session) error     { return nil }

// flakyCreate fails the first creates, as a tmux server still starting does.
type flakyCreate struct {
	*fake.Terminals
	fails int
}

func (f *flakyCreate) Create(ctx context.Context, name, dir, command string, env map[string]string) error {
	if f.fails > 0 {
		f.fails--
		return domain.ErrTmuxCommand.WithDetail("server exited unexpectedly")
	}
	return f.Terminals.Create(ctx, name, dir, command, env)
}

func folderSession(id string, keep bool) domain.Session {
	return domain.Session{
		ID: id, Name: id, Place: domain.PlaceFolder, Folder: "/home/jordi/code/" + id,
		Agent: domain.AgentClaude, State: domain.StateIdle, Keep: keep,
		Launch:  domain.Launch{Conversation: id, Prompt: "fix the list"},
		Windows: []domain.Window{{Index: 0, Name: "claude", Agent: true}},
	}
}

func newRebootedHost(t *testing.T, rebooted bool, fails int, now func() time.Time, saved ...domain.Session) (*app.Service, *flakyCreate) {
	t.Helper()
	terminals := &flakyCreate{Terminals: fake.NewTerminals(), fails: fails}
	places := fake.NewPlaces()
	for _, s := range saved {
		places.Folders[s.Folder] = true
	}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
		Store: &savedMap{sessions: saved}, Rebooted: rebooted, Now: now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, terminals
}

func TestAKeptSessionComesBackAfterAReboot(t *testing.T) {
	ctx := context.Background()
	svc, terminals := newRebootedHost(t, true, 0, nil, folderSession("kept", true), folderSession("plain", false))
	if _, err := svc.RefreshAll(ctx); err != nil {
		t.Fatal(err)
	}
	back := svc.RecoverKept(ctx)
	if len(back) != 1 || back[0].ID != "kept" {
		t.Fatalf("brought back %v", back)
	}
	kept, _ := svc.Get("kept")
	if !kept.State.Live() {
		t.Fatalf("kept session is %s", kept.State)
	}
	// It reopens the conversation and never runs the first task again.
	command := terminals.CommandOf(kept.TmuxName())
	if !strings.Contains(command, "--resume") || strings.Contains(command, "fix the list") {
		t.Fatalf("restarted with %q", command)
	}
	if plain, _ := svc.Get("plain"); plain.State != domain.StateStopped {
		t.Fatalf("a session nobody kept is %s", plain.State)
	}
	if again := svc.RecoverKept(ctx); len(again) != 0 {
		t.Fatalf("brought back twice: %v", again)
	}
}

// A kept session whose agent exited, with no reboot, stays as it was left.
func TestAKeptSessionStaysStoppedWithoutAReboot(t *testing.T) {
	ctx := context.Background()
	svc, _ := newRebootedHost(t, false, 0, nil, folderSession("kept", true))
	_, _ = svc.RefreshAll(ctx)
	if back := svc.RecoverKept(ctx); len(back) != 0 {
		t.Fatalf("brought back without a reboot: %v", back)
	}
}

// A recovery that fails waits its backoff before the next, rather than
// hammering a host that is still coming up.
func TestARecoveryThatFailsBacksOff(t *testing.T) {
	ctx := context.Background()
	clock := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	svc, _ := newRebootedHost(t, true, 2, func() time.Time { return clock }, folderSession("kept", true))
	_, _ = svc.RefreshAll(ctx)
	if back := svc.RecoverKept(ctx); len(back) != 0 {
		t.Fatal("the first attempt was meant to fail")
	}
	if back := svc.RecoverKept(ctx); len(back) != 0 {
		t.Fatal("tried again before its backoff")
	}
	clock = clock.Add(2 * time.Second)
	_ = svc.RecoverKept(ctx) // the second failure
	clock = clock.Add(2 * time.Second)
	if back := svc.RecoverKept(ctx); len(back) != 0 {
		t.Fatal("the second backoff is longer than the first")
	}
	clock = clock.Add(2 * time.Second)
	if back := svc.RecoverKept(ctx); len(back) != 1 {
		t.Fatal("not brought back once the host could take it")
	}
}
