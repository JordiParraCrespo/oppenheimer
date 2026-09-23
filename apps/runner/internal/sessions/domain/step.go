package domain

// Step is one named stage of starting a session, reported as it happens so
// the console can say which part of a slow start is slow instead of spinning
// (05 §"Provisioning"). The names are the wire's: the runner appends them as
// `session.step` events and the console reads them back off the log.
type Step string

const (
	// StepHost is the host picking the session up: the create frame arrived.
	StepHost Step = "host"
	// StepClone is the repository's store on this host: cloned the first
	// time, fetched after.
	StepClone Step = "clone"
	// StepWorktree is the session's own worktree on its own branch.
	StepWorktree Step = "worktree"
	// StepAgent is the tmux session and the agent launched in window 0.
	StepAgent Step = "agent"
)

// StepStatus is where a step is. A failure is not a status here: it is the
// `session.failed` event, and the step that was running is the one that failed.
type StepStatus string

const (
	StepRunning StepStatus = "running"
	StepDone    StepStatus = "done"
)
