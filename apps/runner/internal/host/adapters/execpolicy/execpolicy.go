// Package execpolicy is app.ExecPolicies as one JSON file under the runner
// home (`exec.json`), written by `runner exec` and read on every `host.exec`.
// Nothing on the link writes it: what bots may run on a host is decided on
// the host.
package execpolicy

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

var _ app.ExecPolicies = File{}

// maxSize bounds what is read: a policy is a mode and a short list.
const maxSize = 64 << 10

// File is the policy at Path.
type File struct {
	Path string
}

// Load reads the policy; a file that is not there is the default, off. A
// file another account could write is refused, as the runner's identity is:
// whoever can write it decides what runs as this account.
func (f File) Load() (domain.ExecPolicy, error) {
	info, err := os.Stat(f.Path)
	if errors.Is(err, fs.ErrNotExist) {
		return domain.ExecPolicy{Mode: domain.ExecOff}, nil
	}
	if err != nil {
		return domain.ExecPolicy{}, err
	}
	if info.Mode().Perm()&0o022 != 0 {
		return domain.ExecPolicy{}, fmt.Errorf("%s is writable by other accounts (%v); run chmod 600 on it", f.Path, info.Mode().Perm())
	}
	if info.Size() > maxSize {
		return domain.ExecPolicy{}, fmt.Errorf("%s is larger than %d bytes", f.Path, maxSize)
	}
	raw, err := os.ReadFile(f.Path)
	if err != nil {
		return domain.ExecPolicy{}, err
	}
	var policy domain.ExecPolicy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return domain.ExecPolicy{}, fmt.Errorf("read %s: %w", f.Path, err)
	}
	return policy, nil
}

// Save writes the policy atomically, readable by this account only.
func (f File) Save(policy domain.ExecPolicy) error {
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
