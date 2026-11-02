package app

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Children is how agents run agents (`product/research/lessons-from-herdr.md`):
// an agent in a session starts helpers as sessions of their own, sends them
// work, hears back from them and waits for them, through the runner on its
// own host. A child is recorded with its parent; it tells its parent when it
// needs attention or ends, and it ends with its parent unless it was asked to
// outlive it.
//
// It is a collaborator of the session lifecycle, not part of it: it uses the
// service's own operations (Create, Get, Refresh, Stop, List), types into a
// window through the terminals, reads what agents report, and hears every
// change as a Listener.
type Children struct {
	sessions  *Service
	terminals Terminals
	// program is nil on a runner that wraps no agent: readiness is then the
	// screen's, and nothing can say whether a message set an agent working.
	program ProgramStatus
	now     func() time.Time

	mu sync.Mutex
	// worked holds the sessions seen working since they started, which is
	// what tells a child that finished from one not started yet.
	worked map[string]bool
}

// ChildrenOptions configures Children.
type ChildrenOptions struct {
	Sessions      *Service
	Terminals     Terminals
	ProgramStatus ProgramStatus
}

// NewChildren builds the protocol and has the service tell it every change.
func NewChildren(opts ChildrenOptions) *Children {
	c := &Children{
		sessions: opts.Sessions, terminals: opts.Terminals, program: opts.ProgramStatus,
		now: opts.Sessions.now, worked: map[string]bool{},
	}
	opts.Sessions.Listen(c)
	return c
}

// SessionMoved implements Listener: a session seen working has started its
// work; a child that needs the person or is through tells its parent; a
// session that ended takes its children with it.
func (c *Children) SessionMoved(session domain.Session, stateChanged bool) {
	c.mu.Lock()
	switch {
	case !session.State.Live():
		delete(c.worked, session.ID)
	case session.State == domain.StateWorking:
		c.worked[session.ID] = true
	}
	c.mu.Unlock()
	if !stateChanged {
		return
	}
	c.noteParent(session)
	if !session.State.Live() {
		c.endChildren(session.ID)
	}
}

const (
	// readyWithin bounds how long a message waits for its agent to be up:
	// its first OSC 7501 report, or a screen the classifier can read. An
	// agent that is neither by then may be sitting on a dialog the person
	// has to see, and nothing is typed over it.
	readyWithin = 30 * time.Second
	// startedWithin is how long a sent message is watched for the agent to
	// start working on it.
	startedWithin = 5 * time.Second
	// pollEvery is how often a wait or a readiness check looks again.
	pollEvery = 250 * time.Millisecond
)

// DelegateInput is one child a session's agent starts.
type DelegateInput struct {
	// Parent is the session whose agent asks; the child is its child.
	Parent string
	Agent  domain.Agent
	// Task is the child's first message, in its arguments as any launch's.
	Task string
	Name string
	// Repo and BaseBranch, set, give the child a worktree of its own cut
	// from the base; unset, it runs in the parent's own folder, beside the
	// parent, as a folder session (whose folder is never written to by the
	// runner and never removed).
	Repo       string
	BaseBranch string
	// OutliveParent keeps the child running when its parent ends.
	OutliveParent bool
	// Quiet sends the parent no notes about the child.
	Quiet bool
	// Keep brings the child back on its own after a reboot.
	Keep bool
}

// Delegate starts a child session for a live parent.
func (c *Children) Delegate(ctx context.Context, in DelegateInput) (domain.Session, error) {
	parent, err := c.sessions.Get(in.Parent)
	if err != nil {
		return domain.Session{}, err
	}
	if !parent.State.Live() {
		return domain.Session{}, domain.ErrNotRunning.WithDetail("session %s is %s", parent.ID, parent.State)
	}
	if in.Task == "" {
		return domain.Session{}, domain.ErrInvalidInput.WithDetail("a child needs a task")
	}
	create := CreateInput{
		Agent: in.Agent, Name: in.Name, Launch: domain.Launch{Prompt: in.Task},
		Parent: parent.ID, OutliveParent: in.OutliveParent, Quiet: in.Quiet, Keep: in.Keep,
		Tenant: domain.Tenant{Account: parent.AccountID, Workspace: parent.WorkspaceID},
	}
	if in.Repo != "" {
		create.Repo, create.BaseBranch = in.Repo, in.BaseBranch
		if create.BaseBranch == "" {
			create.BaseBranch = parent.BaseBranch
		}
	} else {
		create.Folder = parent.Cwd()
	}
	return c.sessions.Create(ctx, create)
}

// Of lists a session's children, newest first.
func (c *Children) Of(id string) []domain.Session {
	var out []domain.Session
	for _, session := range c.sessions.List() {
		if session.Parent == id {
			out = append(out, session)
		}
	}
	return out
}

// Told is what a message typed into an agent came to.
type Told struct {
	// Started says whether the agent began working on it soon after; nil
	// when the agent reports no status, so nothing can be said.
	Started *bool `json:"started"`
}

// Tell types a message into a session's agent the way another program
// should: once the agent is up, as a paste, then the agent's own submit key
// after its paste gap (domain.Agent.Input).
func (c *Children) Tell(ctx context.Context, id, text string) (Told, error) {
	session, err := c.sessions.Get(id)
	if err != nil {
		return Told{}, err
	}
	if !session.State.Live() {
		return Told{}, domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return Told{}, domain.ErrInvalidInput.WithDetail("nothing to send")
	}
	if err := c.awaitReady(ctx, id); err != nil {
		return Told{}, err
	}
	turn := c.turnOf(id)
	input := session.Agent.Input()
	// A paste cannot end itself early: the closing bracket is the terminal's.
	text = strings.ReplaceAll(text, "\x1b[201~", "")
	if err := c.terminals.Paste(ctx, session.Target(0), "tell-"+id+fmt.Sprint(c.now().UnixNano()), text); err != nil {
		return Told{}, err
	}
	if !sleep(ctx, input.PasteGap) {
		return Told{}, ctx.Err()
	}
	if err := c.terminals.SendKeys(ctx, session.Target(0), input.Submit); err != nil {
		return Told{}, err
	}
	return Told{Started: c.started(ctx, id, turn)}, nil
}

// Report is a child's message to its parent, delivered into the parent's
// input marked as the child's, so the parent's agent reads it as a report
// rather than as the person typing.
func (c *Children) Report(ctx context.Context, childID, text string) (Told, error) {
	child, err := c.sessions.Get(childID)
	if err != nil {
		return Told{}, err
	}
	if child.Parent == "" {
		return Told{}, domain.ErrNotFound.WithDetail("session %s has no parent to report to", childID)
	}
	return c.Tell(ctx, child.Parent, note(child.ID, "", text))
}

// Wait returns once each of the children has settled: ended, blocked on the
// person, or finished a turn it started. ids empty waits for all of them.
func (c *Children) Wait(ctx context.Context, parent string, ids []string) ([]domain.Session, error) {
	if _, err := c.sessions.Get(parent); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		for _, child := range c.Of(parent) {
			ids = append(ids, child.ID)
		}
	}
	for _, id := range ids {
		child, err := c.sessions.Get(id)
		if err != nil {
			return nil, err
		}
		if child.Parent != parent {
			return nil, domain.ErrNotFound.WithDetail("session %s is not a child of %s", id, parent)
		}
	}
	for {
		out := make([]domain.Session, 0, len(ids))
		settled := true
		for _, id := range ids {
			child, err := c.sessions.Refresh(ctx, id)
			if err != nil {
				child, _ = c.sessions.Get(id)
			}
			out = append(out, child)
			settled = settled && c.settled(child)
		}
		if settled {
			return out, nil
		}
		if !sleep(ctx, pollEvery) {
			return out, ctx.Err()
		}
	}
}

// settled is a child the parent can act on.
func (c *Children) settled(child domain.Session) bool {
	switch {
	case !child.State.Live(), child.State == domain.StateBlocked:
		return true
	case child.State == domain.StateDone, child.State == domain.StateIdle:
		// Idle before its first turn is a child that has not started yet.
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.worked[child.ID]
	}
	return false
}

// awaitReady waits for a session's agent to be up: its first report, or a
// screen the classifier reads as anything but starting.
func (c *Children) awaitReady(ctx context.Context, id string) error {
	deadline := time.Now().Add(readyWithin)
	for {
		if c.program != nil {
			if report, ok := c.program.Read(id); ok && report.Reported {
				return nil
			}
		}
		session, err := c.sessions.Refresh(ctx, id)
		if err == nil {
			switch session.State {
			case domain.StateWorking, domain.StateBlocked, domain.StateIdle, domain.StateDone:
				return nil
			}
			if !session.State.Live() {
				return domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
			}
		}
		if time.Now().After(deadline) {
			return domain.ErrNotReady.WithDetail(
				"the agent in session %s is not up after %s; it may be waiting on a dialog, read its screen first", id, readyWithin)
		}
		if !sleep(ctx, pollEvery) {
			return ctx.Err()
		}
	}
}

// turnOf is the agent's turn counter, or -1 when it reports none.
func (c *Children) turnOf(id string) int {
	if c.program == nil {
		return -1
	}
	report, ok := c.program.Read(id)
	if !ok {
		return -1
	}
	return report.Turn
}

// started watches whether a message set the agent working: its report says
// working, or its turn moved on (a turn that was over before the next look).
func (c *Children) started(ctx context.Context, id string, turn int) *bool {
	if turn < 0 {
		return nil
	}
	deadline := time.Now().Add(startedWithin)
	for {
		if report, ok := c.program.Read(id); ok {
			root, _ := report.Root()
			if root.State == "working" || report.Turn > turn {
				yes := true
				return &yes
			}
		}
		if time.Now().After(deadline) || !sleep(ctx, pollEvery) {
			no := false
			return &no
		}
	}
}

// noteParent tells a child's parent what the child came to, when it needs
// the person (blocked) or is through (done, ended), and the parent wants
// notes. It runs on its own: a parent that is busy, or not up, must not hold
// the refresh that noticed.
func (c *Children) noteParent(child domain.Session) {
	if child.Parent == "" || child.Quiet {
		return
	}
	var said string
	switch {
	case !child.State.Live():
		said = string(child.State)
	case child.State == domain.StateBlocked, child.State == domain.StateDone:
		said = string(child.State)
	default:
		return
	}
	text := ""
	if child.Program != nil {
		text = child.Program.Says()
	}
	ctx, cancel := context.WithTimeout(context.Background(), readyWithin+startedWithin)
	go func() {
		defer cancel()
		_, _ = c.Tell(ctx, child.Parent, note(child.ID, said, text))
	}()
}

// endChildren stops a session's children that were not asked to outlive it,
// once it has ended. Their checkouts stay, as any stop leaves them.
func (c *Children) endChildren(parent string) {
	for _, child := range c.Of(parent) {
		if child.OutliveParent || !child.State.Live() {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_, _ = c.sessions.Stop(ctx, child.ID)
		cancel()
	}
}

// note is a child's message as its parent reads it: marked as the child's,
// with the state it came to when the runner wrote it.
func note(from, state, text string) string {
	attrs := fmt.Sprintf("from=%q", from)
	if state != "" {
		attrs += fmt.Sprintf(" state=%q", state)
	}
	return fmt.Sprintf("<oppenheimer %s>%s</oppenheimer>", attrs, text)
}

// sleep waits d unless ctx ends first, and says whether it waited.
func sleep(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
