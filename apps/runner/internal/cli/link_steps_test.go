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
// a row of the console's stepper. It reports `session.started` instead, and
// the next test holds that, so a terminal stage that reported nothing at all
// would not slip through.
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

// The terminal landing is what says the session can be attached to, so it
// reports `session.started` — and reports it once, with the session in hand.
// Before the terminal was a stage this came from a second lifecycle callback;
// if it stops being reported here, a console would wait for the agent to come
// up before it showed a pane that already existed.
func TestTheTerminalStageReportsTheSessionStarted(t *testing.T) {
	var started []string
	steps := newStartSteps(
		func(link.SessionStepPayload) {},
		func(session sessionsdomain.Session) { started = append(started, session.ID) },
		time.Now,
	)

	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageTerminal})
	if len(started) != 0 {
		t.Fatalf("reported started %v before the terminal landed", started)
	}
	steps.stage(sessionsdomain.StageEvent{
		Stage: sessionsdomain.StageTerminal, Done: true,
		Session: sessionsdomain.Session{ID: "s-1"},
	})
	steps.stage(sessionsdomain.StageEvent{Stage: sessionsdomain.StageClone, Done: true})

	if len(started) != 1 || started[0] != "s-1" {
		t.Fatalf("reported started %v, want [s-1] once, on the terminal landing", started)
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
