package app

import "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"

// observer owns one question: what is the agent in a session doing? Two
// sources answer it. The agent's own report (OSC 7501, kept by the `pty`
// wrapper behind ProgramStatus) outranks the screen classifier while the
// agent holds one: it is the agent saying what it does, where the classifier
// guesses from its screen. The screen keeps two things: a vendor login,
// which no report describes and which is the one link the console offers
// (F3), and every agent that says nothing, or has cleared what it said
// (`product/research/lessons-from-herdr.md`). The refresh loop asks it and
// writes what it answers; a further source is a change here, not there.
type observer struct {
	classifier Classifier
	// program is nil on a runner that wraps no agent: the screen alone.
	program ProgramStatus
}

// observation is what one refresh saw of a session: the state, the vendor
// login the screen showed, and the agent's own word when it gave one.
type observation struct {
	state    domain.State
	loginURL string
	program  *domain.ProgramStatus
}

// observe settles what a session's agent is doing from its window 0 screen
// and from what it reported.
func (o observer) observe(session domain.Session, screen Screen) observation {
	state, loginURL := o.classifier.Classify(screen, session.Agent)
	seen := observation{state: state, loginURL: loginURL}
	if o.program == nil || loginURL != "" {
		return seen
	}
	report, ok := o.program.Read(session.ID)
	if !ok {
		return seen
	}
	root, ok := report.Root()
	if !ok {
		return seen
	}
	return observation{state: root.SessionState(), program: &root}
}

// wrap is the words a session's agent runs under, or none.
func (o observer) wrap(sessionID string) []string {
	if o.program == nil {
		return nil
	}
	return o.program.Wrap(sessionID)
}

// forget drops what a session that ended reported.
func (o observer) forget(sessionID string) {
	if o.program != nil {
		o.program.Forget(sessionID)
	}
}

// sameWord reports whether two reports say the same thing to the person:
// progress alone moving is not news worth an event, so it rides along with
// the next one.
func sameWord(a, b *domain.ProgramStatus) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.State == b.State && a.Kind == b.Kind && a.Message == b.Message && a.Title == b.Title
}
