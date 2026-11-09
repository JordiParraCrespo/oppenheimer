// Package computerpolicy is app.ComputerPolicies as one JSON file under the
// runner home (`computer.json`), written by `runner computer` and read on
// every `computer.act`. Nothing on the link writes it: whether bots may use
// a host's screen is decided on the host.
package computerpolicy

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.ComputerPolicies = File{}

// maxSize bounds what is read: the policy is one switch.
const maxSize = 4 << 10

// File is the policy at Path.
type File struct {
	Path string
}

// Load reads the policy; a file that is not there is the default, off. A
// file another account could write is refused: whoever can write it decides
// who sees this account's screen.
func (f File) Load() (domain.ComputerPolicy, error) {
	info, err := os.Stat(f.Path)
	if errors.Is(err, fs.ErrNotExist) {
		return domain.ComputerPolicy{}, nil
	}
	if err != nil {
		return domain.ComputerPolicy{}, err
	}
	if info.Mode().Perm()&0o022 != 0 {
		return domain.ComputerPolicy{}, fmt.Errorf("%s is writable by other accounts (%v); run chmod 600 on it", f.Path, info.Mode().Perm())
	}
	if info.Size() > maxSize {
		return domain.ComputerPolicy{}, fmt.Errorf("%s is larger than %d bytes", f.Path, maxSize)
	}
	raw, err := os.ReadFile(f.Path)
	if err != nil {
		return domain.ComputerPolicy{}, err
	}
	var policy domain.ComputerPolicy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return domain.ComputerPolicy{}, fmt.Errorf("read %s: %w", f.Path, err)
	}
	return policy, nil
}

// Save writes the policy atomically, readable by this account only.
func (f File) Save(policy domain.ComputerPolicy) error {
	raw, err := json.MarshalIndent(policy, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f.Path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(f.Path), "."+filepath.Base(f.Path)+".*")
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
	return os.Rename(tmp.Name(), f.Path)
}
