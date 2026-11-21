package app

import (
	"context"
	"errors"
	"strings"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// endTerminal ends a session's tmux session and makes sure the agent in it
// went too: killing the tmux session only hangs the pane up, and an agent
// that ignores the hangup would keep running with no pane, long after the
// session reads closed. A failure to look for it is not one to fail the
// close on: EndStrayWrappers comes round again.
func (s *Service) endTerminal(ctx context.Context, session domain.Session) error {
	if err := s.terminals.Kill(ctx, session.TmuxName()); err != nil {
		return err
	}
	_ = s.endSessions(ctx, map[string]bool{session.ID: true})
	return nil
}

// endSessions ends every running wrapper of the sessions named.
func (s *Service) endSessions(ctx context.Context, ids map[string]bool) error {
	if s.wrappers == nil || len(ids) == 0 {
		return nil
	}
	running, err := s.wrappers.Running(ctx)
	if err != nil {
		return err
	}
	var matched []Wrapper
	for _, w := range running {
		if ids[w.SessionID] {
			matched = append(matched, w)
		}
	}
	_, err = s.endEach(ctx, matched)
	return err
}

// endEach ends the wrappers given, all at once: each End may spend the whole
// grace period waiting. It answers the ones it ended.
func (s *Service) endEach(ctx context.Context, wrappers []Wrapper) ([]Wrapper, error) {
	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		ended []Wrapper
		errs  []error
	)
	for _, w := range wrappers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := s.wrappers.End(ctx, w)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, err)
				return
			}
			ended = append(ended, w)
		}()
	}
	wg.Wait()
	return ended, errors.Join(errs...)
}

// EndStrayWrappers ends the wrappers whose session is over: closed or
// stopped in the session map, or whose tmux session is gone. It is the
// safety net behind endTerminal, for an agent a close could not end (a
// runner that stopped halfway, or one from before endTerminal existed). A
// session a command is working on, or still being created, is left to that
// command. It answers the wrappers it ended.
func (s *Service) EndStrayWrappers(ctx context.Context) ([]Wrapper, error) {
	if s.wrappers == nil {
		return nil, nil
	}
	// The processes are listed before tmux, so any wrapper seen was started
	// before the tmux listing: one whose tmux session that listing does not
	// hold has lost it, rather than not having it yet.
	running, err := s.wrappers.Running(ctx)
	if err != nil || len(running) == 0 {
		return nil, err
	}
	names, err := s.terminals.List(ctx)
	if err != nil {
		return nil, err
	}
	live := map[string]bool{}
	for _, name := range names {
		if id, ok := strings.CutPrefix(name, domain.Prefix); ok {
			live[id] = true
		}
	}
	var stray []Wrapper
	s.mu.Lock()
	for _, w := range running {
		_, creating := s.creating[w.SessionID]
		if creating || s.busy[w.SessionID] > 0 {
			continue
		}
		session, known := s.sessions[w.SessionID]
		over := known && (session.State == domain.StateClosed || session.State == domain.StateStopped)
		if over || !live[w.SessionID] {
			stray = append(stray, w)
		}
	}
	s.mu.Unlock()
	// Exactly the processes judged, never a fresh listing: a session
	// restarted since has a new wrapper, and that one is not stray.
	return s.endEach(ctx, stray)
}
