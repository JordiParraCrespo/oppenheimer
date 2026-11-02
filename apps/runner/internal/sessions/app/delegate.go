package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Agents run agents (`product/research/lessons-from-herdr.md`): an agent in a
// session starts helpers as sessions of their own, sends them work, hears
// back from them and waits for them, through the runner on its own host. A
// child is recorded with its parent; it tells its parent when it needs
// attention or ends, and it ends with its parent unless it was asked to
// outlive it.

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
}

// Delegate starts a child session for a live parent.
func (s *Service) Delegate(ctx context.Context, in DelegateInput) (domain.Session, error) {
	parent, err := s.recorded(in.Parent)
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
		Parent: parent.ID, OutliveParent: in.OutliveParent, Quiet: in.Quiet,
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
	return s.Create(ctx, create)
}

// Children lists a session's children, newest first.
func (s *Service) Children(id string) []domain.Session {
	var out []domain.Session
	for _, session := range s.List() {
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
func (s *Service) Tell(ctx context.Context, id, text string) (Told, error) {
	session, err := s.recorded(id)
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
	if err := s.awaitReady(ctx, id); err != nil {
		return Told{}, err
	}
	turn := s.turnOf(id)
	input := session.Agent.Input()
	// A paste cannot end itself early: the closing bracket is the terminal's.
	text = strings.ReplaceAll(text, "\x1b[201~", "")
	if err := s.terminals.Paste(ctx, session.Target(0), "tell-"+id+fmt.Sprint(s.now().UnixNano()), text); err != nil {
		return Told{}, err
	}
	if !sleep(ctx, input.PasteGap) {
		return Told{}, ctx.Err()
	}
	if err := s.terminals.SendKeys(ctx, session.Target(0), input.Submit); err != nil {
		return Told{}, err
	}
	return Told{Started: s.started(ctx, id, turn)}, nil
}

// Report is a child's message to its parent, delivered into the parent's
// input marked as the child's, so the parent's agent reads it as a report
// rather than as the person typing.
func (s *Service) Report(ctx context.Context, childID, text string) (Told, error) {
	child, err := s.recorded(childID)
	if err != nil {
		return Told{}, err
	}
	if child.Parent == "" {
		return Told{}, domain.ErrNotFound.WithDetail("session %s has no parent to report to", childID)
	}
	return s.Tell(ctx, child.Parent, note(child.ID, "", text))
}

// Wait returns once each of the children has settled: ended, blocked on the
// person, or finished a turn it started. ids empty waits for all of them.
func (s *Service) Wait(ctx context.Context, parent string, ids []string) ([]domain.Session, error) {
	if _, err := s.recorded(parent); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		for _, child := range s.Children(parent) {
			ids = append(ids, child.ID)
		}
	}
	for _, id := range ids {
		child, err := s.recorded(id)
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
			child, err := s.Refresh(ctx, id)
			if err != nil {
				child, _ = s.recorded(id)
			}
			out = append(out, child)
			settled = settled && s.settled(child)
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
func (s *Service) settled(child domain.Session) bool {
	switch {
	case !child.State.Live(), child.State == domain.StateBlocked:
		return true
	case child.State == domain.StateDone, child.State == domain.StateIdle:
		// Idle before its first turn is a child that has not started yet.
		s.mu.Lock()
		defer s.mu.Unlock()
		return s.worked[child.ID]
	}
	return false
}

// awaitReady waits for a session's agent to be up: its first report, or a
// screen the classifier reads as anything but starting.
func (s *Service) awaitReady(ctx context.Context, id string) error {
	deadline := time.Now().Add(readyWithin)
	for {
		if s.program != nil {
			if report, ok := s.program.Read(id); ok && report.Reported {
				return nil
			}
		}
		session, err := s.Refresh(ctx, id)
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
func (s *Service) turnOf(id string) int {
	if s.program == nil {
		return -1
	}
	report, ok := s.program.Read(id)
	if !ok {
		return -1
	}
	return report.Turn
}

// started watches whether a message set the agent working: its report says
// working, or its turn moved on (a turn that was over before the next look).
func (s *Service) started(ctx context.Context, id string, turn int) *bool {
	if turn < 0 {
		return nil
	}
	deadline := time.Now().Add(startedWithin)
	for {
		if report, ok := s.program.Read(id); ok {
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
func (s *Service) noteParent(child domain.Session) {
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
		text = strings.TrimSpace(strings.Join(nonEmpty(child.Program.Kind, child.Program.Message), ": "))
	}
	ctx, cancel := context.WithTimeout(context.Background(), readyWithin+startedWithin)
	go func() {
		defer cancel()
		_, _ = s.Tell(ctx, child.Parent, note(child.ID, said, text))
	}()
}

// endChildren stops a session's children that were not asked to outlive it,
// once it has ended. Their checkouts stay, as any stop leaves them.
func (s *Service) endChildren(parent string) {
	for _, child := range s.Children(parent) {
		if child.OutliveParent || !child.State.Live() {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_, _ = s.Stop(ctx, child.ID)
		cancel()
	}
}

// ended is everything a session owes once it is no longer live, whichever
// way it ended: a refresh that found it gone, or a stop or close.
func (s *Service) ended(session domain.Session) {
	if s.program != nil {
		s.program.Forget(session.ID)
	}
	s.mu.Lock()
	delete(s.worked, session.ID)
	s.mu.Unlock()
	s.noteParent(session)
	s.endChildren(session.ID)
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

func nonEmpty(words ...string) []string {
	var out []string
	for _, word := range words {
		if word != "" {
			out = append(out, word)
		}
	}
	return out
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
