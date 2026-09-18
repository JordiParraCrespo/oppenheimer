// Package state persists the session map: which tmux session belongs to which
// worktree, branch and repository. It is a cache — the control plane is the
// source of truth and tmux is the live registry — that exists so a runner
// which boots before its link comes up still knows what it is looking at.
package state

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Store = (*Store)(nil)

// FileName is the map's name inside the runner's state directory.
const FileName = "sessions.json"

// Store reads and writes the map.
type Store struct{ path string }

// New builds a store under dir.
func New(dir string) *Store { return &Store{path: filepath.Join(dir, FileName)} }

// Path is the file's location, for `runner status`.
func (s *Store) Path() string { return s.path }

// Load returns an empty map on a host that has never opened a session.
func (s *Store) Load() ([]domain.Session, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var sessions []domain.Session
	if err := json.Unmarshal(raw, &sessions); err != nil {
		// A corrupt cache must not stop a runner: tmux still holds the
		// sessions and adoption will find them.
		return nil, nil //nolint:nilerr // an unreadable cache is an empty cache, deliberately
	}
	return sessions, nil
}

// Save writes the map atomically, 0600.
func (s *Store) Save(sessions []domain.Session) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
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
