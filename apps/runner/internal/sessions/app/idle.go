package app

import (
	"context"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// An idle session stops on its own. A session whose agent finished its turn
// (`done`) or sits at its prompt (`idle`) and that nobody has looked at or
// typed into for IdleStop.After is stopped, never closed: its processes go,
// its checkout, branch and the agent's conversation stay, and opening it in
// the console restarts it where it left off. Stopping is the one thing that
// costs nothing to undo, which is why it is the only thing done here.
//
// Left alone: an agent that is working or waiting on the person, a session
// with a second agent in another window (whose state is not read), a session
// someone is attached to (from the console or on the host) or typed into
// within the window, a kept session (`--keep`), a child whose parent is still
// live, and a parent with a child that is not idle too, since stopping a
// parent stops its children.

// DefaultIdleStopAfter is how long a session sits finished and unwatched
// before it is stopped. Two hours: past a meeting or a lunch, so the person
// who steps away comes back to a running terminal, and short enough that a
// day's forgotten sessions are gone by the evening rather than piling up for
// a week (the 110 idle agents that cost a Mac 8-10 GB).
const DefaultIdleStopAfter = 2 * time.Hour

// presence is who is looking at each session: the attachments open on it now
// and when it was last looked at or typed into, by id.
type presence struct {
	mu       sync.Mutex
	attached map[string]int
	touched  map[string]time.Time
}

func newPresence() *presence {
	return &presence{attached: map[string]int{}, touched: map[string]time.Time{}}
}

func (p *presence) touch(id string, now time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.touched[id] = now
}

// attach counts an attachment open; the release it answers counts it closed,
// once, and stamps the moment the last look ended.
func (p *presence) attach(id string, now func() time.Time) (release func()) {
	p.mu.Lock()
	p.attached[id]++
	p.touched[id] = now()
	p.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			p.mu.Lock()
			defer p.mu.Unlock()
			p.touched[id] = now()
			if p.attached[id]--; p.attached[id] <= 0 {
				delete(p.attached, id)
			}
		})
	}
}

// watched reports whether someone is attached, and when the session was
// last looked at or typed into.
func (p *presence) watched(id string) (attached bool, touched time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.attached[id] > 0, p.touched[id]
}

func (p *presence) forget(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.attached[id] == 0 {
		delete(p.touched, id)
	}
}

// watchedAttachment is an attachment the presence counts until it closes.
type watchedAttachment struct {
	Attachment
	release func()
}

func (a *watchedAttachment) Close() error {
	a.release()
	return a.Attachment.Close()
}

// StopIdle stops every session idle for longer than after and answers the
// ones it stopped. A session found idle is looked at again under the stop's
// own hold, so an agent that started working, or a person who attached, in
// between keeps it running. Who is attached on the host is read once a pass;
// a pass that cannot read it stops nothing.
func (s *Service) StopIdle(ctx context.Context, after time.Duration) []domain.Session {
	if after <= 0 {
		return nil
	}
	var stopped []domain.Session
	for _, id := range s.idleCandidates(ctx, after) {
		if ctx.Err() != nil {
			break
		}
		// A fresh look first, at the session and at every session that
		// would stop with it: the state the candidates were picked on is
		// the poll loop's, up to an interval old, and an agent handed work
		// since (by a person on the host, by its parent) must not be stopped
		// on it. A look that fails stops nothing.
		if !s.lookAgain(ctx, id) {
			continue
		}
		// Read again for each: a person may have attached while the last
		// stop waited on its agent.
		looks, err := s.looks(ctx)
		if err != nil {
			break
		}
		session, ok, err := s.stopIfIdle(ctx, id, after, looks)
		if err == nil && ok {
			stopped = append(stopped, session)
		}
	}
	return stopped
}

// lookAgain refreshes a session and every session that would stop with it,
// and says whether every look worked.
func (s *Service) lookAgain(ctx context.Context, id string) bool {
	for _, each := range append([]string{id}, s.line(id)...) {
		if _, err := s.Refresh(ctx, each); err != nil {
			return false
		}
	}
	return true
}

// line is the live sessions that would stop with id: its children that do
// not outlive it, theirs, and on down (Children.endChildren).
func (s *Service) line(id string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	seen := map[string]bool{id: true}
	var line []string
	var walk func(parent string)
	walk = func(parent string) {
		for _, child := range s.sessions {
			if child.Parent != parent || !child.State.Live() || child.OutliveParent || seen[child.ID] {
				continue
			}
			seen[child.ID] = true
			line = append(line, child.ID)
			walk(child.ID)
		}
	}
	walk(id)
	return line
}

// looking is who is looking at each session right now, from every source
// there is: the attaches and keystrokes this service saw, and the tmux
// clients on the host, which it never sees attach.
type looking struct {
	presence *presence
	clients  map[string]int
}

func (s *Service) looks(ctx context.Context) (looking, error) {
	l := looking{presence: s.presence}
	if s.clients == nil {
		return l, nil
	}
	clients, err := s.clients.Clients(ctx)
	l.clients = clients
	return l, err
}

// inUse reports whether someone is looking at a session now, and when it was
// last looked at or typed into.
func (l looking) inUse(session domain.Session) (now bool, last time.Time) {
	attached, touched := l.presence.watched(session.ID)
	return attached || l.clients[session.TmuxName()] > 0, touched
}

func (s *Service) idleCandidates(ctx context.Context, after time.Duration) []string {
	looks, err := s.looks(ctx)
	if err != nil {
		return nil
	}
	now := s.now()
	s.mu.Lock()
	defer s.mu.Unlock()
	var ids []string
	for id, session := range s.sessions {
		// A command working on the session keeps it.
		if s.busy[id] == 0 && s.idleLocked(session, now, after, looks) {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *Service) stopIfIdle(ctx context.Context, id string, after time.Duration, looks looking) (domain.Session, bool, error) {
	defer s.hold(id)()
	s.mu.Lock()
	session, known := s.sessions[id]
	// The one hold is this stop's own: any other command still working on
	// the session keeps it.
	idle := known && s.busy[id] == 1 && s.idleLocked(session, s.now(), after, looks)
	s.mu.Unlock()
	if !idle {
		return domain.Session{}, false, nil
	}
	if err := s.endTerminal(ctx, session); err != nil {
		return domain.Session{}, false, err
	}
	return s.decide(session, domain.StateStopped, ""), true, nil
}

// idleLocked is whether a session is due to stop: itself idle (idleSelf)
// and not held running by its family. s.mu is held.
func (s *Service) idleLocked(session domain.Session, now time.Time, after time.Duration, looks looking) bool {
	if !s.idleSelfLocked(session, now, after, looks) {
		return false
	}
	// A child answers a parent that may still read it.
	if session.Parent != "" {
		if parent, ok := s.sessions[session.Parent]; ok && parent.State.Live() {
			return false
		}
	}
	return s.descendantsIdleLocked(session.ID, now, after, looks, map[string]bool{session.ID: true})
}

// descendantsIdleLocked is whether every session that would stop with id is
// idle too. Stopping a parent stops the children that do not outlive it, and
// each of those its own (Children.endChildren), so a working, kept or
// watched session anywhere down that line keeps the whole line running, and
// a family idle through and through stops, parent first and the rest with
// it. seen guards against a parent link that loops. s.mu is held.
func (s *Service) descendantsIdleLocked(id string, now time.Time, after time.Duration, looks looking, seen map[string]bool) bool {
	for _, child := range s.sessions {
		if child.Parent != id || !child.State.Live() || child.OutliveParent || seen[child.ID] {
			continue
		}
		seen[child.ID] = true
		if s.busy[child.ID] > 0 || !s.idleSelfLocked(child, now, after, looks) ||
			!s.descendantsIdleLocked(child.ID, now, after, looks, seen) {
			return false
		}
	}
	return true
}

// idleSelfLocked is whether a session is, on its own, finished or at its
// prompt for longer than after, since its last change and since anyone last
// looked at it or typed into it, with none of its own reasons to keep
// running. s.mu is held.
func (s *Service) idleSelfLocked(session domain.Session, now time.Time, after time.Duration, looks looking) bool {
	if session.State != domain.StateDone && session.State != domain.StateIdle {
		return false
	}
	if session.Keep {
		return false
	}
	if _, creating := s.creating[session.ID]; creating {
		return false
	}
	// Only window 0's agent is read for the session's state, and a stop ends
	// every window: a second agent in another tab may be working.
	for _, w := range session.Windows {
		if w.Index != 0 && w.Agent {
			return false
		}
	}
	inUse, last := looks.inUse(session)
	if inUse {
		return false
	}
	since := session.Updated
	if last.After(since) {
		since = last
	}
	return now.Sub(since) >= after
}
