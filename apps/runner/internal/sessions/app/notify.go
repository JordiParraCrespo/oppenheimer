package app

import (
	"crypto/rand"
	"encoding/hex"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Notify tells the person something on behalf of a session's agent: a line
// that reaches the console's Inbox as `agent.notified`, whether or not
// anyone is watching the session. The link's reporter keeps it until the
// control plane has it, so a link that is down only delays it.
func (s *Service) Notify(id, text string) (domain.Notice, error) {
	session, err := s.recorded(id)
	if err != nil {
		return domain.Notice{}, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return domain.Notice{}, domain.ErrInvalidInput.WithDetail("a notice needs words")
	}
	if len(text) > domain.NoticeMaxBytes {
		return domain.Notice{}, domain.ErrInvalidInput.WithDetail(
			"a notice is at most %d bytes, this one is %d: say it in a line", domain.NoticeMaxBytes, len(text))
	}
	s.mu.Lock()
	notifier, ok := s.publisher.(Notifier)
	s.mu.Unlock()
	if !ok {
		return domain.Notice{}, domain.ErrNotify.WithDetail("this runner has no link to the control plane")
	}
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return domain.Notice{}, err
	}
	notice := domain.Notice{ID: hex.EncodeToString(raw[:]), Text: text}
	notifier.Notified(session.ID, notice)
	return notice, nil
}
