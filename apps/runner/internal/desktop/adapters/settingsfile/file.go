// Package settingsfile keeps a host's desktop settings as one JSON file under
// the runner home (`desktop.json`), written by `runner desktop` and read on
// every `desktop.open`, and reads the password file those settings name.
// Nothing on the link writes either: whether a host's screen can be watched
// and driven from the console is decided on the host.
package settingsfile

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

var (
	_ app.SettingsStore = File{}
	_ app.Secrets       = File{}
)

// maxSize bounds what is read: settings are four fields, a password one line.
const maxSize = 64 << 10

// File is the settings at Path.
type File struct {
	Path string
}

// Load reads the settings; a file that is not there is the default, off. A
// file another account could write is refused: whoever can write it decides
// whether this account's screen is shared.
func (f File) Load() (domain.Settings, error) {
	raw, err := readPrivate(f.Path, false)
	if errors.Is(err, fs.ErrNotExist) {
		return domain.Settings{}, nil
	}
	if err != nil {
		return domain.Settings{}, err
	}
	var settings domain.Settings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return domain.Settings{}, fmt.Errorf("read %s: %w", f.Path, err)
	}
	return settings, nil
}

// Save writes the settings atomically, readable by this account only.
func (f File) Save(settings domain.Settings) error {
	raw, err := json.MarshalIndent(settings, "", "  ")
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

// Password is the first line of the file at path, which no other account may
// read: it signs in to this account's screen.
func (File) Password(path string) (string, error) {
	raw, err := readPrivate(path, true)
	if err != nil {
		return "", err
	}
	line, _, _ := strings.Cut(string(raw), "\n")
	return strings.TrimSuffix(line, "\r"), nil
}

// readPrivate reads a small file no other account may write, nor, when
// secret, read.
func readPrivate(path string, secret bool) ([]byte, error) {
	path = filepath.Clean(path)
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	forbidden := os.FileMode(0o022)
	if secret {
		forbidden = 0o077
	}
	if info.Mode().Perm()&forbidden != 0 {
		return nil, fmt.Errorf("%s is open to other accounts (%v); run chmod 600 on it", path, info.Mode().Perm())
	}
	if info.Size() > maxSize {
		return nil, fmt.Errorf("%s is larger than %d bytes", path, maxSize)
	}
	return os.ReadFile(path)
}
