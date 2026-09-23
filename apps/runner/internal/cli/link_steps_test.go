package cli

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A stage the service runs but the wire cannot name would never reach the
// console, so every stage has a wire step.
func TestEveryStageOfCreateHasAWireStep(t *testing.T) {
	for _, stage := range sessionsdomain.Stages {
		if _, ok := wireSteps[stage]; !ok {
			t.Fatalf("stage %q has no session.step name", stage)
		}
	}
}

// What the console is told, in order: the host has the frame, the host
// accepted it, then each stage started and landed with the time it took.
func TestAStartIsLoggedHostFirstWithHostMeasuredDurations(t *testing.T) {
	clock := time.Unix(1_000, 0)
	now := func() time.Time { return clock }
	var logged []string
	steps := newStartSteps(func(p link.SessionStepPayload) {
		entry := string(p.Step) + ":" + string(p.Status)
		if p.DurationMs != nil {
			entry += fmt.Sprintf("(%dms)", *p.DurationMs)
		}
		logged = append(logged, entry)
	}, now)

	clock = clock.Add(40 * time.Millisecond)
	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageClone})
	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageClone, Done: true, Took: 1340 * time.Millisecond})
	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageWorktree})

	want := "host:running host:done(40ms) clone:running clone:done(1340ms) worktree:running"
	if got := strings.Join(logged, " "); got != want {
		t.Fatalf("logged %q, want %q", got, want)
	}
}

// A start refused before create accepts it leaves the host step in hand, so
// the console marks the host step, not the clone, as the one that failed.
func TestAStartRefusedBeforeAnyStageLeavesTheHostStepRunning(t *testing.T) {
	var logged []string
	newStartSteps(func(p link.SessionStepPayload) {
		logged = append(logged, string(p.Step)+":"+string(p.Status))
	}, time.Now)
	if got := strings.Join(logged, " "); got != "host:running" {
		t.Fatalf("logged %q, want only host:running", got)
	}
}
