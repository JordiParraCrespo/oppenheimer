package app

import (
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// watchBook is every session's terminal watches, in memory: the control plane
// sends them again on every hello, so a restart loses nothing it cannot
// replace. Its own lock, because a scan runs regexps over a screen and must
// not hold the session map meanwhile.
type watchBook struct {
	mu        sync.Mutex
	bySession map[string]map[string]*domain.Watch
}

func newWatchBook() *watchBook {
	return &watchBook{bySession: map[string]map[string]*domain.Watch{}}
}

// matched is one report a scan made.
type matched struct {
	watchID string
	count   int
}

func (b *watchBook) put(sessionID string, watch *domain.Watch) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.bySession[sessionID] == nil {
		b.bySession[sessionID] = map[string]*domain.Watch{}
	}
	b.bySession[sessionID][watch.ID()] = watch
}

func (b *watchBook) remove(sessionID, watchID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.bySession[sessionID], watchID)
	if len(b.bySession[sessionID]) == 0 {
		delete(b.bySession, sessionID)
	}
}

func (b *watchBook) drop(sessionID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.bySession, sessionID)
}

// keepOnly drops the watches of every session keep says no to.
func (b *watchBook) keepOnly(keep func(sessionID string) bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for id := range b.bySession {
		if !keep(id) {
			delete(b.bySession, id)
		}
	}
}

// scan runs a session's watches over one capture and returns the reports
// due, dropping each watch that has made its last.
func (b *watchBook) scan(sessionID, body string, now func() time.Time) []matched {
	b.mu.Lock()
	defer b.mu.Unlock()
	watches := b.bySession[sessionID]
	if len(watches) == 0 {
		return nil
	}
	at := now()
	var out []matched
	for id, watch := range watches {
		if count, report := watch.Scan(body, at); report {
			out = append(out, matched{watchID: id, count: count})
		}
		if watch.Spent() {
			delete(watches, id)
		}
	}
	if len(watches) == 0 {
		delete(b.bySession, sessionID)
	}
	return out
}

// Watch starts a terminal watch on a session, replacing any with the same
// id. The session must be one this host knows that is running or still being
// created (ErrNotFound, ErrNotRunning), and the pattern a valid one
// (ErrInvalidPattern).
func (s *Service) Watch(sessionID, watchID, pattern string) error {
	session, err := s.Get(sessionID)
	if err != nil {
		return err
	}
	if !session.State.Live() && session.State != domain.StateCreating {
		return domain.ErrNotRunning.WithDetail("session %s is %s", sessionID, session.State)
	}
	watch, err := domain.NewWatch(watchID, pattern)
	if err != nil {
		return err
	}
	s.watches.put(sessionID, watch)
	return nil
}

// Unwatch stops a terminal watch; one this host does not hold is nothing to
// do.
func (s *Service) Unwatch(sessionID, watchID string) {
	s.watches.remove(sessionID, watchID)
}

// scanWatches runs a session's watches over the screen a refresh captured
// and publishes each report due. Only the count leaves: never the text.
func (s *Service) scanWatches(sessionID, body string) {
	reports := s.watches.scan(sessionID, body, s.now)
	if len(reports) == 0 {
		return
	}
	s.mu.Lock()
	publisher := s.publisher
	s.mu.Unlock()
	for _, report := range reports {
		publisher.TerminalMatched(sessionID, report.watchID, report.count)
	}
}

// pruneWatches drops the watches of every session that is no longer running
// or being created, or that this host no longer knows.
func (s *Service) pruneWatches() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.watches.keepOnly(func(id string) bool {
		if _, creating := s.creating[id]; creating {
			return true
		}
		session, ok := s.sessions[id]
		return ok && session.State.Live()
	})
}
