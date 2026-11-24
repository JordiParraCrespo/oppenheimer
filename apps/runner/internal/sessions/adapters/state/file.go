// Package state persists the session map (app.Store): which tmux session
// belongs to which worktree, branch and repository.
//
// More than one runner process can hold the map at once: the daemon, and
// `runner sessions …` run on the host with no daemon to go through, several
// at a time. Each holds the copy it loaded, so a save merges rather than
// overwrites: under a lock across processes, it reads the file and writes
// over it only the sessions this process changed since it last loaded or
// saved them. Another process's sessions, and its changes to sessions this
// one only holds a stale copy of, are kept; so is a close another process
// made, over this one's change to the same session.
package state

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Store = (*Store)(nil)

// FileName is the map's name inside the runner's state directory.
const FileName = "sessions.json"

// lockName is the lock file beside the map, held across a save's read and
// write.
const lockName = "." + FileName + ".lock"

// Store reads and writes the map.
type Store struct {
	path string
	mu   sync.Mutex
	// seen is each session as this process last loaded or saved it,
	// encoded: a session the next save hands over unchanged from it is one
	// this process did not touch, and the file's copy of it stands.
	seen map[string][]byte
}

// New builds a store under dir.
func New(dir string) *Store {
	return &Store{path: filepath.Join(dir, FileName), seen: map[string][]byte{}}
}

// Path is the file's location.
func (s *Store) Path() string { return s.path }

// Load returns an empty map on a host that has never opened a session.
func (s *Store) Load() ([]domain.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sessions, err := s.read()
	if err != nil {
		return nil, err
	}
	for _, session := range sessions {
		s.seen[session.ID] = encode(session)
	}
	return sessions, nil
}

// read is the file's map; nil for none, and for one that does not parse:
// a corrupt cache must not stop a runner, as tmux still holds the sessions
// and adoption will find them.
func (s *Store) read() ([]domain.Session, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var sessions []domain.Session
	if err := json.Unmarshal(raw, &sessions); err != nil {
		return nil, nil //nolint:nilerr // an unreadable cache is an empty cache, deliberately
	}
	return sessions, nil
}

// Save writes the sessions this process changed into the map, atomically,
// 0600, keeping every other session the file holds as it is there.
func (s *Store) Save(sessions []domain.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	unlock, err := lock(filepath.Join(filepath.Dir(s.path), lockName))
	if err != nil {
		return err
	}
	defer unlock()

	onDisk, err := s.read()
	if err != nil {
		return err
	}
	merged := make([]domain.Session, 0, len(onDisk)+len(sessions))
	at := map[string]int{}
	for _, session := range onDisk {
		at[session.ID] = len(merged)
		merged = append(merged, session)
	}
	changed := map[string][]byte{}
	for _, session := range sessions {
		encoded := encode(session)
		i, there := at[session.ID]
		if there && bytes.Equal(s.seen[session.ID], encoded) {
			continue
		}
		if there && closedElsewhere(merged[i], s.seen[session.ID], session) {
			continue
		}
		changed[session.ID] = encoded
		if there {
			merged[i] = session
		} else {
			at[session.ID] = len(merged)
			merged = append(merged, session)
		}
	}
	if err := s.write(merged); err != nil {
		return err
	}
	for id, encoded := range changed {
		s.seen[id] = encoded
	}
	return nil
}

func (s *Store) write(sessions []domain.Session) error {
	raw, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(s.path), "."+FileName+".*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // best effort on the failure path
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(append(raw, '\n')); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), s.path)
}

// closedElsewhere reports a session another process closed since this one
// last saw it, which this one, holding it live, would write back open: the
// daemon marking stopped a session `runner sessions close` ended. A close is
// final, so the file's copy stands. A session this process closed and
// started again itself is not one.
func closedElsewhere(onDisk domain.Session, seen []byte, mine domain.Session) bool {
	return onDisk.State == domain.StateClosed && mine.State != domain.StateClosed &&
		!bytes.Equal(encode(onDisk), seen)
}

func encode(session domain.Session) []byte {
	raw, _ := json.Marshal(session)
	return raw
}
