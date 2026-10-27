package app_test

import (
	"context"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const permissionScreen = "Bash command\n  pnpm test\n\nDo you want to proceed?\n❯ 1. Yes\n  2. No\n"

// A blocked agent's permission dialog is reported once when it appears, not
// on every poll, and cleared once the agent moves on: the Inbox shows what is
// pending now and nothing the agent stopped waiting on.
func TestAPermissionDialogIsReportedWhenItAppearsAndClearedWhenItGoes(t *testing.T) {
	clock := &stepClock{now: time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)}
	h := newClockedHarness(t, clock)
	session := h.open(t)
	refresh := func(screen string) {
		t.Helper()
		h.terminals.Screens[session.Target(0)] = screen
		if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
			t.Fatal(err)
		}
	}

	refresh(workingScreen)
	if len(h.events.decisions) != 0 {
		t.Fatalf("a working agent reported %d decisions", len(h.events.decisions))
	}

	refresh(permissionScreen)
	refresh(permissionScreen)
	if len(h.events.decisions) != 1 || h.events.decisions[0] == nil {
		t.Fatalf("decisions = %v, want the dialog once", h.events.decisions)
	}
	if got := h.events.decisions[0]; got.Kind != domain.DecisionPermissionKind || len(got.Options) != 2 {
		t.Fatalf("decision = %+v", got)
	}

	refresh(workingScreen)
	if len(h.events.decisions) != 2 || h.events.decisions[1] != nil {
		t.Fatalf("decisions = %v, want it cleared", h.events.decisions)
	}
}

// A blocked screen that is not a dialog reports nothing pending.
func TestABlockedScreenWithNoDialogReportsNone(t *testing.T) {
	clock := &stepClock{now: time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)}
	h := newClockedHarness(t, clock)
	session := h.open(t)
	h.terminals.Screens[session.Target(0)] = "Waiting for your input"
	if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}
	if len(h.events.decisions) != 0 {
		t.Fatalf("decisions = %v", h.events.decisions)
	}
}
