// Package file stores the identity and the host key under the runner's home
// directory: config.json 0600, host.key 0600, the directory 0700. Writes are
// atomic (write a temp file, rename over) so an interrupted registration
// leaves either the old identity or the new one, never half of one.
package file

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

var _ app.Store = (*Store)(nil)

// File names inside the runner home.
const (
	ConfigFile = "config.json"
	KeyFile    = "host.key"
)

// Store is the on-disk identity.
type Store struct{ dir string }

// New builds a store rooted at the runner home (~/.oppenheimer by default).
func New(dir string) *Store { return &Store{dir: dir} }

// ConfigPath is where the identity lives, for messages that tell a user which
// file to look at.
func (s *Store) ConfigPath() string { return filepath.Join(s.dir, ConfigFile) }

// KeyPath is where the private key lives.
func (s *Store) KeyPath() string { return filepath.Join(s.dir, KeyFile) }

// Load reads the identity and the key. A key any other account can read is
// refused rather than used: the whole host authenticates with it (F8).
func (s *Store) Load() (domain.Identity, ed25519.PrivateKey, error) {
	raw, err := os.ReadFile(s.ConfigPath())
	if errors.Is(err, os.ErrNotExist) {
		return domain.Identity{}, nil, domain.ErrNotPaired
	}
	if err != nil {
		return domain.Identity{}, nil, err
	}
	var identity domain.Identity
	if err := json.Unmarshal(raw, &identity); err != nil {
		return domain.Identity{}, nil, fmt.Errorf("read %s: %w", s.ConfigPath(), err)
	}

	info, err := os.Stat(s.KeyPath())
	if errors.Is(err, os.ErrNotExist) {
		return identity, nil, domain.ErrNotPaired
	}
	if err != nil {
		return identity, nil, err
	}
	if perm := info.Mode().Perm(); perm&0o077 != 0 {
		return identity, nil, fmt.Errorf("%w: %s is %#o, expected 0600", domain.ErrKeyPermissions, s.KeyPath(), perm)
	}
	encoded, err := os.ReadFile(s.KeyPath())
	if err != nil {
		return identity, nil, err
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(encoded)))
	if err != nil {
		return identity, nil, fmt.Errorf("decode %s: %w", s.KeyPath(), err)
	}
	if len(key) != ed25519.PrivateKeySize {
		return identity, nil, fmt.Errorf("%s holds %d bytes, expected %d", s.KeyPath(), len(key), ed25519.PrivateKeySize)
	}
	return identity, ed25519.PrivateKey(key), nil
}

// Save writes both files, the key first: a config without a key reads as
// "not paired", which is recoverable, while a key without a config is not.
func (s *Store) Save(identity domain.Identity, key ed25519.PrivateKey) error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	encoded := base64.StdEncoding.EncodeToString(key)
	if err := writeAtomic(s.KeyPath(), []byte(encoded+"\n"), 0o600); err != nil {
		return err
	}
	return s.SaveIdentity(identity)
}

// SaveIdentity rewrites config.json only, for a channel or pin change.
func (s *Store) SaveIdentity(identity domain.Identity) error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(identity, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(s.ConfigPath(), append(raw, '\n'), 0o600)
}

// Clear removes the identity and the key, and nothing else: the runner home
// also holds logs and installed binaries, which uninstall deals with
// separately, and the user's code is not under this directory at all.
func (s *Store) Clear() error {
	var errs []error
	for _, path := range []string{s.KeyPath(), s.ConfigPath()} {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func writeAtomic(path string, content []byte, mode os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // best effort on the failure path
	if err := tmp.Chmod(mode); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
