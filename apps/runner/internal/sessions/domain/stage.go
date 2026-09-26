package domain

import "time"

// Stage is one of the stages Create runs, in order. Each is observable on
// disk, which is what makes a failure half-way something a person can look at.
type Stage string

const (
	// StageClone is the repository's store on this host: cloned the first
	// time, fetched after.
	StageClone Stage = "clone"
	// StageWorktree is the session's own worktree on its own branch.
	StageWorktree Stage = "worktree"
	// StageAgent is the tmux session and the agent launched in window 0.
	StageAgent Stage = "agent"
)

// Stages are every stage, in the order Create runs them.
var Stages = []Stage{StageClone, StageWorktree, StageAgent}

// StageEvent is a stage starting or landing. Took is set when it landed: how
// long it ran, measured here. A stage that fails never lands; the failure is
// Create's error, and the stage that started last is the one that failed.
type StageEvent struct {
	Stage Stage
	Done  bool
	Took  time.Duration
}
