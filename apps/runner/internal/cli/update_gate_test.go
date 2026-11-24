package cli

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	upddomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

// activations records what a rollback activates.
type activations struct {
	*heldDownload
	mu        sync.Mutex
	activated []string
}

func (a *activations) Activate(version string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.activated = append(a.activated, version)
	return nil
}

func (a *activations) got() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]string(nil), a.activated...)
}

func gatedApp(t *testing.T) (*App, *memoryUpdateState, *activations) {
	t.Helper()
	state := &memoryUpdateState{state: upddomain.State{From: "1.0.0", To: "1.1.0", Phase: upddomain.PhasePending, Attempts: 1}}
	bins := &activations{heldDownload: &heldDownload{entered: make(chan context.Context, 1), release: make(chan struct{})}}
	a := &App{Version: "1.1.0"}
	a.Updates = updapp.New(updapp.Options{Binaries: bins, State: state, Version: "1.1.0", Channel: "stable"})
	return a, state, bins
}

func wait(t *testing.T, what string, done <-chan bool) bool {
	t.Helper()
	select {
	case ok := <-done:
		return ok
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for %s", what)
		return false
	}
}

// 0.1.24 stayed up for the gate while every hello it sent was refused, and
// was marked healthy. A pending update now waits for a link.
func TestAPendingUpdateWaitsForALinkBeforeItIsHealthy(t *testing.T) {
	a, _, bins := gatedApp(t)
	done := make(chan bool, 1)
	go func() { done <- a.awaitLinkOrRollBack(context.Background(), slog.Default()) }()

	for range helloRefusalsToRollBack - 1 {
		a.gate.noteRefused()
	}
	select {
	case <-done:
		t.Fatal("the gate closed with no link")
	case <-time.After(50 * time.Millisecond):
	}
	a.gate.noteLinked()
	if !wait(t, "the gate to close on the link", done) {
		t.Fatal("a link that came up did not pass the gate")
	}
	if got := bins.got(); len(got) != 0 {
		t.Fatalf("activated %v; a linked update is kept", got)
	}
}

// Refused helloRefusalsToRollBack times with no link, the update rolls back.
func TestAPendingUpdateTheControlPlaneKeepsRefusingRollsBack(t *testing.T) {
	a, state, bins := gatedApp(t)
	done := make(chan bool, 1)
	go func() { done <- a.awaitLinkOrRollBack(context.Background(), slog.Default()) }()
	for range helloRefusalsToRollBack {
		a.gate.noteRefused()
		time.Sleep(time.Millisecond)
	}
	if wait(t, "the rollback", done) {
		t.Fatal("the gate passed an update that never linked")
	}
	if got := bins.got(); len(got) != 1 || got[0] != "1.0.0" {
		t.Fatalf("activated %v, want the rollback to 1.0.0", got)
	}
	if recorded, _ := state.Load(); recorded.Phase != upddomain.PhaseRolled {
		t.Fatalf("state = %+v, want rolled back", recorded)
	}
}

// A link resets the run: refusals on either side of it do not add up.
func TestALinkResetsTheRunOfRefusals(t *testing.T) {
	var g updateGate
	for range helloRefusalsToRollBack - 1 {
		g.noteRefused()
	}
	g.noteLinked()
	g.noteLinked() // idempotent
	g.noteRefused()
	if g.refusedEnough() {
		t.Fatal("refusals across a link were counted as one run")
	}
}
