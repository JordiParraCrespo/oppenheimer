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
// console, so every stage has a wire step — except the terminal, which is not
// a row of the console's stepper and is made before the others.
func TestEveryStageOfCreateHasAWireStepExceptTheTerminal(t *testing.T) {
	for _, stage := range sessionsdomain.Stages {
		_, named := wireSteps[stage]
		if stage == sessionsdomain.StageTerminal {
			if named {
				t.Fatalf("the terminal stage has a wire step %q; the stepper is host/clone/worktree/agent", stage)
			}
			continue
		}
		if !named {
			t.Fatalf("stage %q has no session.step name", stage)
		}
	}
}

// The agent landing is what opens the session, so it reports
// `session.started` — once, with the session in hand, and not before: the
// terminal and the clone landing earlier leave the console on its stepper, so
// a session opens on its agent rather than on a shell waiting for a clone.
func TestTheAgentLandingReportsTheSessionStarted(t *testing.T) {
	var started []string
	var log []string
	steps := newStartSteps(
		func(p link.SessionStepPayload) { log = append(log, string(p.Step)+":"+string(p.Status)) },
		func(session sessionsdomain.Session) {
			started = append(started, session.ID)
			log = append(log, "started")
		},
		time.Now,
	)

	for _, stage := range []sessionsdomain.Stage{
		sessionsdomain.StageTerminal, sessionsdomain.StageClone, sessionsdomain.StageWorktree,
	} {
		steps.stage(sessionsdomain.StageEvent{Stage: stage})
		steps.stage(sessionsdomain.StageEvent{Stage: stage, Done: true, Session: sessionsdomain.Session{ID: "s-1"}})
	}
	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageAgent})
	if len(started) != 0 {
		t.Fatalf("reported started %v before the agent landed", started)
	}
	steps.stage(sessionsdomain.StageEvent{
		Stage: sessionsdomain.StageAgent, Done: true,
		Session: sessionsdomain.Session{ID: "s-1"},
	})

	if len(started) != 1 || started[0] != "s-1" {
		t.Fatalf("reported started %v, want [s-1] once, on the agent landing", started)
	}
	// The console stops reading the log at session.started, so the agent's
	// own step must be logged before it.
	if got := strings.Join(log[len(log)-2:], " "); got != "agent:done started" {
		t.Fatalf("the log ends %q, want the agent's step and then started", got)
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
	}, nil, now)

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
	}, nil, time.Now)
	if got := strings.Join(logged, " "); got != "host:running" {
		t.Fatalf("logged %q, want only host:running", got)
	}
}
