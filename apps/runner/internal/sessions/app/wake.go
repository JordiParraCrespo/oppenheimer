package app

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Waker is the part of a Publisher that asks the control plane to wake a
// session's agent at a time, as `wake.requested`. Optional, like Notifier.
type Waker interface {
	WakeRequested(sessionID string, wake domain.WakeRequest)
}

// WakeLater asks the control plane to type text back into a session in
// delay, once its agent is at its prompt then: an agent that waits on
// something slow (a deploy, a review, a long CI run) sleeps instead of
// polling. The control plane holds the wake, so it survives this runner
// restarting; the host must be up when it is due.
func (s *Service) WakeLater(id string, delay time.Duration, text string, now time.Time) (domain.WakeRequest, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.WakeRequest{}, err
	}
	if delay < domain.WakeMinDelay || delay > domain.WakeMaxDelay {
		return domain.WakeRequest{}, domain.ErrInvalidInput.WithDetail(
			"a wake is between %s and %s away, not %s", domain.WakeMinDelay, "7 days", delay)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return domain.WakeRequest{}, domain.ErrInvalidInput.WithDetail("say what to tell yourself when you wake")
	}
	if len(text) > domain.WakeTextMaxBytes {
		return domain.WakeRequest{}, domain.ErrInvalidInput.WithDetail(
			"a wake's note is at most %d bytes, this one is %d", domain.WakeTextMaxBytes, len(text))
	}
	s.mu.Lock()
	waker, ok := s.publisher.(Waker)
	s.mu.Unlock()
	if !ok {
		return domain.WakeRequest{}, domain.ErrNoLink.WithDetail("nothing can wake this session without one")
	}
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return domain.WakeRequest{}, err
	}
	wake := domain.WakeRequest{
		ID:   hex.EncodeToString(raw[:]),
		At:   now.Add(delay).UTC().Format(time.RFC3339),
		Text: text,
	}
	waker.WakeRequested(session.ID, wake)
	return wake, nil
}
