// Package policyfile keeps the host's own switches for bots, each a small
// JSON file under the runner home: what `runner computer` and `runner
// browser` write and every action reads. Nothing on the link writes these files:
// what bots may do on a host is decided on the host.
package policyfile

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

var (
	_ app.ComputerPolicies = Computer{}
	_ app.BrowserPolicies  = Browser{}
)

// Computer is app.ComputerPolicies at Path (`computer.json`).
type Computer struct {
	Path string
}

// Load reads the policy; a file that is not there is the default, off.
func (f Computer) Load() (domain.ComputerPolicy, error) { return load[domain.ComputerPolicy](f.Path) }

// Save writes the policy.
func (f Computer) Save(policy domain.ComputerPolicy) error { return save(f.Path, policy) }

// Browser is app.BrowserPolicies at Path (`browser.json`).
type Browser struct {
	Path string
}

// Load reads the policy; a file that is not there is the default, off.
func (f Browser) Load() (domain.BrowserPolicy, error) { return load[domain.BrowserPolicy](f.Path) }

// Save writes the policy.
func (f Browser) Save(policy domain.BrowserPolicy) error { return save(f.Path, policy) }

// maxSize bounds what is read: a setting is a switch or two.
const maxSize = 4 << 10

// load reads the setting at path; a file that is not there is T's zero
// value, which every setting here means as off. A file another account
// could write is refused: whoever can write it decides what bots do as this
// account.
func load[T any](path string) (T, error) {
	var setting T
	info, err := os.Stat(path)
	if errors.Is(err, fs.ErrNotExist) {
		return setting, nil
	}
	if err != nil {
		return setting, err
	}
	if info.Mode().Perm()&0o022 != 0 {
		return setting, fmt.Errorf("%s is writable by other accounts (%v); run chmod 600 on it", path, info.Mode().Perm())
	}
	if info.Size() > maxSize {
		return setting, fmt.Errorf("%s is larger than %d bytes", path, maxSize)
	}
	raw, err := os.ReadFile(path) //nolint:gosec // the runner's own settings file
	if err != nil {
		return setting, err
	}
	if err := json.Unmarshal(raw, &setting); err != nil {
		var zero T
		return zero, fmt.Errorf("read %s: %w", path, err)
	}
	return setting, nil
}

// save writes the setting atomically, readable by this account only.
func save[T any](path string, setting T) error {
	raw, err := json.MarshalIndent(setting, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
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
	return os.Rename(tmp.Name(), path)
}
