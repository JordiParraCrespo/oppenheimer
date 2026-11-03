package app

import "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"

// FileShared tells the control plane, as `file.shared`, what a file the
// session's agent shared is: its id, name, type, size, caption and whether the
// runner kept a preview of it. The path and the bytes stay on the host. A
// runner with no link skips it, since the chat on this host already shows the
// file; it reports whether the event was handed to the link.
func (s *Service) FileShared(id string, file domain.SharedFile) (bool, error) {
	session, err := s.Get(id)
	if err != nil {
		return false, err
	}
	s.mu.Lock()
	sharer, ok := s.publisher.(FileSharer)
	s.mu.Unlock()
	if !ok {
		return false, nil
	}
	sharer.FileShared(session.ID, file)
	return true, nil
}
