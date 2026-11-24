package app_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/adapters/release"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// A pin set by `runner update --pin` while the daemon runs is honoured at its
// next check: 0.1.22 read the pin once at boot and updated past one.
func TestAPinSetWhileRunningIsHonouredAtTheNextCheck(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	pin := ""
	svc := app.New(app.Options{
		Releases: release.New(release.Options{BaseURL: rs.URL, Target: rs.target, HTTP: rs.Client(), Keys: rs.keys}),
		Binaries: h.store, Restarter: h.restarts, State: h.state,
		Version: "1.0.0", Channel: "stable", PinnedNow: func() string { return pin },
	})
	if plan, err := svc.Check(context.Background()); err != nil || plan.Action == domain.ActionNone {
		t.Fatalf("unpinned check = %+v, %v; want an update offered", plan, err)
	}

	pin = "1.0.0" // the CLI writes the identity from another process
	_, err := svc.Apply(context.Background(), app.ApplyOptions{})
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "UPD_004" {
		t.Fatalf("err = %v, want UPD_004 for a pin set after boot", err)
	}
	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q, want the pinned 1.0.0", got)
	}
}

// A pending update whose binary the control plane refuses is rolled back.
func TestRollBackUnlinkedReturnsAPendingUpdateToThePreviousVersion(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	if _, err := h.svc.Apply(context.Background(), app.ApplyOptions{}); err != nil {
		t.Fatal(err)
	}
	restarts := &restarter{}
	booted := app.New(app.Options{Binaries: h.store, Restarter: restarts, State: h.state, Version: "1.1.0"})
	if _, err := booted.NoteBoot(context.Background()); err != nil {
		t.Fatal(err)
	}

	rolled, err := booted.RollBackUnlinked(context.Background())
	if err != nil || !rolled {
		t.Fatalf("rolled = %v, err = %v; want a rollback", rolled, err)
	}
	if got, _ := h.store.Current(); got != "1.0.0" {
		t.Fatalf("current = %q, want 1.0.0", got)
	}
	if restarts.calls != 1 {
		t.Fatalf("restarts = %d, want one", restarts.calls)
	}
	if recorded, _ := h.state.Load(); recorded.Phase != domain.PhaseRolled {
		t.Fatalf("state = %+v, want rolled back", recorded)
	}
}

// A healthy update, or none, is never rolled back for a refused hello: the
// refusal then says something about the control plane, not this update.
func TestRollBackUnlinkedLeavesAClosedUpdateAlone(t *testing.T) {
	rs := newReleaseServer(t, "1.1.0")
	h := newHarness(t, rs, "1.0.0")
	if rolled, err := h.svc.RollBackUnlinked(context.Background()); err != nil || rolled {
		t.Fatalf("no update: rolled = %v, err = %v", rolled, err)
	}
	if _, err := h.svc.Apply(context.Background(), app.ApplyOptions{}); err != nil {
		t.Fatal(err)
	}
	booted := app.New(app.Options{Binaries: h.store, Restarter: &restarter{}, State: h.state, Version: "1.1.0"})
	if err := booted.MarkHealthy(); err != nil {
		t.Fatal(err)
	}
	if rolled, err := booted.RollBackUnlinked(context.Background()); err != nil || rolled {
		t.Fatalf("healthy update: rolled = %v, err = %v", rolled, err)
	}
	if got, _ := h.store.Current(); got != "1.1.0" {
		t.Fatalf("current = %q, want 1.1.0 kept", got)
	}
}
