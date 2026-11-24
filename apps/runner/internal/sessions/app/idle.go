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
// someone is attached to or typed into within the window, a kept session
// (`--keep`), a child whose parent is still live, and a parent with a child
// still live.

// DefaultIdleStopAfter is how long a session sits finished and unwatched
// before it is stopped. Two hours: past a meeting or a lunch, so the person
// who steps away comes back to a running terminal, and short enough that a
// day's forgotten sessions are gone by the evening rather than piling up for
// a week (the 110 idle agents that cost a Mac 8-10 GB).
const DefaultIdleStopAfter = 2 * time.Hour

// IdleStop tunes the idle stop; After zero turns it off.
type IdleStop struct {
	After time.Duration
}

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
// between keeps it running.
func (s *Service) StopIdle(ctx context.Context, after time.Duration) []domain.Session {
	if after <= 0 {
		return nil
	}
	var stopped []domain.Session
	for _, id := range s.idleCandidates(after) {
		if ctx.Err() != nil {
			break
		}
		session, ok, err := s.stopIfIdle(ctx, id, after)
		if err == nil && ok {
			stopped = append(stopped, session)
		}
	}
	return stopped
}

func (s *Service) idleCandidates(after time.Duration) []string {
	now := s.now()
	s.mu.Lock()
	defer s.mu.Unlock()
	var ids []string
	for id, session := range s.sessions {
		if s.idleLocked(session, now, after, 0) {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *Service) stopIfIdle(ctx context.Context, id string, after time.Duration) (domain.Session, bool, error) {
	defer s.hold(id)()
	s.mu.Lock()
	session, known := s.sessions[id]
	// The hold is this stop's own; any other command still working on the
	// session keeps it.
	idle := known && s.idleLocked(session, s.now(), after, 1)
	s.mu.Unlock()
	if !idle {
		return domain.Session{}, false, nil
	}
	if err := s.endTerminal(ctx, session); err != nil {
		return domain.Session{}, false, err
	}
	return s.decide(session, domain.StateStopped, ""), true, nil
}

// idleLocked is whether a session is due to stop: finished or at its prompt
// for longer than after, since its last change and since anyone last looked
// at it or typed into it, with none of the reasons to leave it running. s.mu
// is held, and held is how many holds on the session are the caller's own.
func (s *Service) idleLocked(session domain.Session, now time.Time, after time.Duration, held int) bool {
	if session.State != domain.StateDone && session.State != domain.StateIdle {
		return false
	}
	if session.Keep || s.busy[session.ID] > held {
		return false
	}
	if _, creating := s.creating[session.ID]; creating {
		return false
	}
	attached, touched := s.presence.watched(session.ID)
	if attached {
		return false
	}
	since := session.Updated
	if touched.After(since) {
		since = touched
	}
	if now.Sub(since) < after {
		return false
	}
	return !s.familyLiveLocked(session)
}

// familyLiveLocked is whether the session's parent, or any child of it, is
// still live: a child answers a parent that may still read it, and a parent
// waits on its children. s.mu is held.
func (s *Service) familyLiveLocked(session domain.Session) bool {
	if session.Parent != "" {
		if parent, ok := s.sessions[session.Parent]; ok && parent.State.Live() {
			return true
		}
	}
	for _, other := range s.sessions {
		if other.Parent == session.ID && other.State.Live() {
			return true
		}
	}
	return false
}
