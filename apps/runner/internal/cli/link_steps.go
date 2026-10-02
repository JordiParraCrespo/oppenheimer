package cli

import (
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// wireSteps names each stage of create on the wire. The service knows its
// stages; the wire's names are packages/shared's, generated into link.
//
// StageTerminal is deliberately absent: the console's stepper is
// `host/clone/worktree/agent` and the terminal is not one of its rows.
var wireSteps = map[sessionsdomain.Stage]link.SessionStep{
	sessionsdomain.StageClone:    link.SessionStepClone,
	sessionsdomain.StageWorktree: link.SessionStepWorktree,
	sessionsdomain.StageAgent:    link.SessionStepAgent,
}

// startSteps logs one session's start as `session.step` events (01): `host`
// running the moment the create frame arrives, `host` done once create has
// accepted the session and begun its first stage, then each stage as it
// starts and lands, with the time it took measured here.
//
// It also reports `session.started`, off StageAgent landing: the agent has
// been sent into the pane, so the session opens on the agent rather than on a
// shell waiting for a clone, and the console's stepper has the stages before
// it to show (02 §5, 03). The pane itself is made first, so an attach is
// served the moment the session opens.
type startSteps struct {
	emit     func(link.SessionStepPayload)
	started  func(sessionsdomain.Session)
	now      func() time.Time
	arrived  time.Time
	accepted bool
}

func newStartSteps(
	emit func(link.SessionStepPayload),
	started func(sessionsdomain.Session),
	now func() time.Time,
) *startSteps {
	s := &startSteps{emit: emit, started: started, now: now, arrived: now()}
	s.emit(link.SessionStepPayload{Step: link.SessionStepHost, Status: link.SessionStepRunning})
	return s
}

// stage is create's progress callback.
func (s *startSteps) stage(ev sessionsdomain.StageEvent) {
	if !s.accepted {
		s.accepted = true
		s.emit(done(link.SessionStepHost, s.now().Sub(s.arrived)))
	}
	if ev.Stage == sessionsdomain.StageAgent && ev.Done && s.started != nil {
		s.started(ev.Session)
	}
	step, ok := wireSteps[ev.Stage]
	if !ok {
		return
	}
	if ev.Done {
		s.emit(done(step, ev.Took))
		return
	}
	s.emit(link.SessionStepPayload{Step: step, Status: link.SessionStepRunning})
}

func done(step link.SessionStep, took time.Duration) link.SessionStepPayload {
	ms := took.Milliseconds()
	return link.SessionStepPayload{Step: step, Status: link.SessionStepDone, DurationMs: &ms}
}
