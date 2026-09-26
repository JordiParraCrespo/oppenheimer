// Package images keeps the pictures pasted into a session's prompt on disk,
// one directory per session under the runner's home.
package images

import (
	"errors"
	"os"
	"path/filepath"
)

// Store is app.Images over a directory.
type Store struct {
	dir string
}

// New keeps images under dir, `~/.oppenheimer/images` in production.
func New(dir string) *Store { return &Store{dir: dir} }

// Save writes one image and returns its absolute path. The directory and the
// file are the runner account's alone: a screenshot can hold anything that
// was on somebody's screen.
func (s *Store) Save(sessionID, name string, data []byte) (string, error) {
	if !plain(sessionID) || !plain(name) {
		return "", errors.New("an image is named by a plain file name")
	}
	dir := filepath.Join(s.dir, sessionID)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path, err := filepath.Abs(filepath.Join(dir, name))
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return "", err
	}
	return path, nil
}

// Delete removes one image; one that is already gone is not an error.
func (s *Store) Delete(sessionID, name string) error {
	if !plain(sessionID) || !plain(name) {
		return errors.New("an image is named by a plain file name")
	}
	err := os.Remove(filepath.Join(s.dir, sessionID, name))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

// Discard removes a session's directory and everything in it.
func (s *Store) Discard(sessionID string) error {
	if !plain(sessionID) {
		return errors.New("a session is named by a plain file name")
	}
	return os.RemoveAll(filepath.Join(s.dir, sessionID))
}

// plain is a single path element that climbs nowhere.
func plain(name string) bool {
	return name != "" && name != "." && name != ".." && filepath.Base(name) == name
}
