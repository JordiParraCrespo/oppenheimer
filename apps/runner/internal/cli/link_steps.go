package cli

import (
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// wireSteps names each stage of create on the wire. The service knows its
// stages; the wire's names are packages/shared's, generated into link.
var wireSteps = map[sessionsdomain.Stage]link.SessionStep{
	sessionsdomain.StageClone:    link.SessionStepClone,
	sessionsdomain.StageWorktree: link.SessionStepWorktree,
	sessionsdomain.StageAgent:    link.SessionStepAgent,
}

// startSteps logs one session's start as `session.step` events (01): `host`
// running the moment the create frame arrives, `host` done once create has
// accepted the session and begun its first stage, then each stage as it
// starts and lands, with the time it took measured here.
type startSteps struct {
	emit     func(link.SessionStepPayload)
	now      func() time.Time
	arrived  time.Time
	accepted bool
}

func newStartSteps(emit func(link.SessionStepPayload), now func() time.Time) *startSteps {
	s := &startSteps{emit: emit, now: now, arrived: now()}
	s.emit(link.SessionStepPayload{Step: link.SessionStepHost, Status: link.SessionStepRunning})
	return s
}

// stage is create's progress callback.
func (s *startSteps) stage(ev sessionsdomain.StageEvent) {
	if !s.accepted {
		s.accepted = true
		s.emit(done(link.SessionStepHost, s.now().Sub(s.arrived)))
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
