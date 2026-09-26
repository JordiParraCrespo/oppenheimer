// Package state persists update.json: the one thing that survives the restart
// an update causes, and therefore the only way the process that finishes an
// update knows what the process that started it was doing.
package state

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
)

var _ app.StateStore = (*Store)(nil)

// FileName is the record's name inside the runner's state directory.
const FileName = "update.json"

// Store reads and writes the record.
type Store struct{ path string }

// New builds a store under dir (~/.oppenheimer/state).
func New(dir string) *Store { return &Store{path: filepath.Join(dir, FileName)} }

// Path is the record's location, for `runner status`.
func (s *Store) Path() string { return s.path }

// Load returns an empty record on a host that has never updated.
func (s *Store) Load() (domain.State, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return domain.State{}, nil
	}
	if err != nil {
		return domain.State{}, err
	}
	var state domain.State
	if err := json.Unmarshal(raw, &state); err != nil {
		// A corrupt record must not wedge the runner: treat it as no
		// record, which costs at most one missed rollback.
		return domain.State{}, nil //nolint:nilerr // an unreadable record is "no record", deliberately
	}
	return state, nil
}

// Save writes the record atomically, 0600.
func (s *Store) Save(state domain.State) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(state, "", "  ")
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
