package app

import (
	"context"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A kept session comes back after a reboot on its own
// (`product/research/lessons-from-herdr.md`). Without it, a reboot leaves
// every session stopped and waits for someone to press Restart; with it, the
// runner restarts the session once it is up again, which reopens the agent's
// conversation in the same checkout and never runs the first task twice
// (Restart). Only a reboot does this: a session whose agent exited, or that
// somebody stopped or closed, stays as it was left.

// recoverBackoff is how long a failed recovery waits before the next, as
// herdr-core spaces them; it then stays at the last step for as long as the
// session is kept. The poll loop that runs RecoverKept is slower than the
// first steps, so in practice those wait for its next tick.
var recoverBackoff = []time.Duration{
	1500 * time.Millisecond, 3 * time.Second, 6 * time.Second, 12 * time.Second, 30 * time.Second, time.Minute,
}

// recovery is one session lost to a reboot, until it is back or let go.
type recovery struct {
	attempts int
	next     time.Time
}

// keeper holds the kept sessions a reboot stopped, each with its backoff,
// until each is back. It is filled once, when the service loads a session
// map the host booted after (Options.Rebooted).
type keeper struct {
	mu   sync.Mutex
	lost map[string]*recovery
}

func newKeeper() *keeper { return &keeper{lost: map[string]*recovery{}} }

func (k *keeper) lose(id string) {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.lost[id] = &recovery{}
}

// due is the sessions to try now, letting go of those nobody keeps anymore.
func (k *keeper) due(now time.Time, get func(string) (domain.Session, error)) []string {
	k.mu.Lock()
	defer k.mu.Unlock()
	var due []string
	for id, r := range k.lost {
		session, err := get(id)
		switch {
		case err != nil, !session.Keep, session.State == domain.StateClosed:
			delete(k.lost, id)
		case session.State == domain.StateStopped && !now.Before(r.next):
			due = append(due, id)
		}
	}
	return due
}

// tried records an attempt: a session that is back is let go, and one that
// failed waits its next backoff.
func (k *keeper) tried(id string, now time.Time, ok bool) {
	k.mu.Lock()
	defer k.mu.Unlock()
	r, known := k.lost[id]
	switch {
	case !known:
	case ok:
		delete(k.lost, id)
	default:
		r.next = now.Add(recoverBackoff[min(r.attempts, len(recoverBackoff)-1)])
		r.attempts++
	}
}

// Keep sets whether a session comes back on its own after a reboot.
func (s *Service) Keep(id string, keep bool) (domain.Session, error) {
	if _, err := s.recorded(id); err != nil {
		return domain.Session{}, err
	}
	next, _, _ := s.commit(id, func(cur domain.Session, known bool) (domain.Session, bool) {
		if !known || cur.Keep == keep {
			return cur, false
		}
		cur.Keep = keep
		return cur, true
	})
	return next, nil
}

// RecoverKept restarts the kept sessions a reboot stopped, each when its
// backoff allows, and returns the ones it brought back. It runs after a
// refresh, which is what finds them stopped.
func (s *Service) RecoverKept(ctx context.Context) []domain.Session {
	now := s.now()
	var back []domain.Session
	for _, id := range s.keeper.due(now, s.Get) {
		session, err := s.Restart(ctx, id)
		s.keeper.tried(id, now, err == nil)
		if err == nil {
			back = append(back, session)
		}
	}
	return back
}
