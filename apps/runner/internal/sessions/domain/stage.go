package domain

import "time"

// Stage is one of the stages Create runs, in order.
type Stage string

const (
	// StageTerminal is the session's tmux session, made before the repository
	// is there: the pane is what a console attaches to, and it is ready about
	// thirty milliseconds in rather than after the clone (02 §5).
	//
	// It is the one stage with no step on the wire. The console's stepper is
	// `host/clone/worktree/agent` and stays that way; what this stage reports
	// is `session.started`, because that is the moment the session has a
	// terminal to attach to.
	StageTerminal Stage = "terminal"
	// StageClone is the repository's store on this host: cloned the first
	// time, fetched after.
	StageClone Stage = "clone"
	// StageWorktree is the session's own worktree on its own branch.
	StageWorktree Stage = "worktree"
	// StageAgent is the agent launched into window 0 of the terminal
	// StageTerminal made.
	StageAgent Stage = "agent"
)

// Stages are every stage, in the order Create runs them.
var Stages = []Stage{StageTerminal, StageClone, StageWorktree, StageAgent}

// StageEvent is a stage starting or landing. Took is set when it landed: how
// long it ran, measured here. A stage that fails never lands; the failure is
// Create's error, and the stage that started last is the one that failed.
type StageEvent struct {
	Stage Stage
	Done  bool
	Took  time.Duration
	// Session is the session as it stands at this stage. It is what lets the
	// link report `session.started` off StageTerminal landing, rather than
	// through a second lifecycle callback saying the same thing.
	Session Session
}
