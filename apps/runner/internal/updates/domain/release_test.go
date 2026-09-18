package domain_test

import (
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

func TestCompareOrdersReleases(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"1.2.4", "1.2.3", 1},
		{"1.3.0", "1.2.9", 1},
		{"2.0.0", "1.99.99", 1},
		{"1.2.3", "1.2.10", -1},
		{"v1.2.3", "1.2.3", 0},
		{"1.2.3", "1.2.3-beta.1", 1}, // a release is newer than its prerelease
		{"1.2.3-beta.2", "1.2.3-beta.1", 1},
		{"dev", "1.0.0", -1}, // a development build is never newer
		{"1.0.0", "dev", 1},
	} {
		if got := domain.Compare(tc.a, tc.b); got != tc.want {
			t.Errorf("Compare(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

func release(version string) domain.Release {
	return domain.Release{Channel: "stable", Version: version, Artifact: domain.Artifact{URL: "https://r/x", SHA256: "ab"}}
}

func TestDecideTakesANewerVersionWhenTheHostIsQuiet(t *testing.T) {
	plan := domain.Decide("1.0.0", release("1.1.0"), "", domain.Activity{}, time.Time{}, time.Now())

	if plan.Action != domain.ActionUpdateNow {
		t.Fatalf("plan = %+v, want an immediate update on an idle host", plan)
	}
}

func TestDecideWaitsWhileSomeoneIsWatching(t *testing.T) {
	plan := domain.Decide("1.0.0", release("1.1.0"), "",
		domain.Activity{WorkingSessions: 1, AttachedClients: 2}, time.Now(), time.Now())

	if plan.Action != domain.ActionUpdate {
		t.Fatalf("plan = %+v, want it to wait", plan)
	}
}

func TestDecideStopsWaitingAfterTheCap(t *testing.T) {
	now := time.Now()
	waiting := now.Add(-domain.SafeWindowCap - time.Minute)

	plan := domain.Decide("1.0.0", release("1.1.0"), "", domain.Activity{WorkingSessions: 3}, waiting, now)

	if plan.Action != domain.ActionUpdateNow {
		t.Fatalf("plan = %+v, want the cap to win over a busy host", plan)
	}
}

func TestDecideAppliesAnUrgentReleaseImmediately(t *testing.T) {
	r := release("1.1.0")
	r.Urgent = true

	plan := domain.Decide("1.0.0", r, "", domain.Activity{WorkingSessions: 5, AttachedClients: 5}, time.Now(), time.Now())

	if plan.Action != domain.ActionUpdateNow {
		t.Fatalf("plan = %+v, want an urgent release to skip the window", plan)
	}
}

func TestDecideRespectsAPin(t *testing.T) {
	plan := domain.Decide("1.0.0", release("1.1.0"), "1.0.0", domain.Activity{}, time.Time{}, time.Now())

	if plan.Action != domain.ActionBlocked {
		t.Fatalf("plan = %+v, want a pinned host to stay put", plan)
	}
	if plan.Reason == "" {
		t.Fatal("a blocked plan must say why, so the console can show it")
	}
}

func TestDecideOverridesEvenAPinWhenTheRunnerIsTooOld(t *testing.T) {
	r := release("2.0.0")
	r.MinSupported = "1.5.0"

	plan := domain.Decide("1.0.0", r, "1.0.0", domain.Activity{WorkingSessions: 4}, time.Time{}, time.Now())

	// A host the control plane will not talk to is broken now; a pin is a
	// preference, not a reason to stay unreachable.
	if plan.Action != domain.ActionUpdateNow {
		t.Fatalf("plan = %+v, want a required update to win", plan)
	}
}

func TestDecideDoesNothingWhenAlreadyCurrentOrOlder(t *testing.T) {
	for _, offered := range []string{"1.0.0", "0.9.0"} {
		plan := domain.Decide("1.0.0", release(offered), "", domain.Activity{}, time.Time{}, time.Now())
		if plan.Action != domain.ActionNone {
			t.Fatalf("offered %s: plan = %+v, want none", offered, plan)
		}
	}
}

func TestShouldRollBackOnlyAfterTheAttemptsAreSpent(t *testing.T) {
	state := domain.State{From: "1.0.0", To: "1.1.0", Phase: domain.PhasePending, Attempts: 1}
	if state.ShouldRollBack("1.1.0") {
		t.Fatal("one boot is not a failure; the health gate has not run yet")
	}
	state.Attempts = domain.MaxAttempts
	if !state.ShouldRollBack("1.1.0") {
		t.Fatal("a new version that keeps booting without ever going healthy must roll back")
	}
	healthy := state.Healthy(time.Now())
	if healthy.ShouldRollBack("1.1.0") {
		t.Fatal("a healthy update is never rolled back")
	}
}
