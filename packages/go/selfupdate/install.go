package selfupdate

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Errors about the layout on disk.
var (
	ErrVersionName    = errors.New("selfupdate: version is not a safe file name")
	ErrVersionMissing = errors.New("selfupdate: version is not installed")
	ErrNoCurrent      = errors.New("selfupdate: no current version is linked")
)

// safeVersion keeps a version string to characters that cannot walk out of
// the layout directory. The manifest is signed, but a path is still a path.
var safeVersion = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$`)

// Layout is the versioned binary directory:
//
//	<dir>/<name>-<version>   one file per installed version
//	<dir>/current            a symlink the service unit points at
//	<dir>/.staging/          downloads, never executed from here
//
// The service unit refers only to `current`, so activating a version is a
// symlink rename and a restart, with no unit file to rewrite.
type Layout struct {
	Dir  string
	Name string
}

// NewLayout returns a layout and creates its directories 0700.
func NewLayout(dir, name string) (Layout, error) {
	l := Layout{Dir: dir, Name: name}
	if name == "" {
		return l, errors.New("selfupdate: layout needs a binary name")
	}
	for _, d := range []string{l.Dir, l.StagingDir()} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return l, err
		}
	}
	return l, nil
}

// StagingDir is where downloads land before they are verified.
func (l Layout) StagingDir() string { return filepath.Join(l.Dir, ".staging") }

// CurrentPath is the stable path the service unit executes.
func (l Layout) CurrentPath() string { return filepath.Join(l.Dir, "current") }

// VersionPath is where one installed version lives.
func (l Layout) VersionPath(version string) (string, error) {
	if !safeVersion.MatchString(version) {
		return "", fmt.Errorf("%w: %q", ErrVersionName, version)
	}
	return filepath.Join(l.Dir, l.Name+"-"+version), nil
}

// Promote moves a staged, verified binary into place as a version. It does
// not activate it: the caller runs the new binary's own self-check first.
func (l Layout) Promote(stagedPath, version string) (string, error) {
	target, err := l.VersionPath(version)
	if err != nil {
		return "", err
	}
	// 0700: an executable only its owner may read or run.
	if err := os.Chmod(stagedPath, 0o700); err != nil { //nolint:gosec // an executable owned by, and readable only by, this user
		return "", err
	}
	// Same filesystem by construction (staging is a subdirectory), so this
	// is an atomic rename rather than a copy that can be interrupted.
	if err := os.Rename(stagedPath, target); err != nil {
		return "", err
	}
	return target, nil
}

// Activate points `current` at an installed version by renaming a fresh
// symlink over the old one, so no window exists where `current` is missing.
func (l Layout) Activate(version string) error {
	target, err := l.VersionPath(version)
	if err != nil {
		return err
	}
	if _, err := os.Stat(target); err != nil {
		return fmt.Errorf("%w: %s", ErrVersionMissing, version)
	}
	tmp := filepath.Join(l.Dir, ".current."+version)
	_ = os.Remove(tmp)
	if err := os.Symlink(filepath.Base(target), tmp); err != nil {
		return err
	}
	if err := os.Rename(tmp, l.CurrentPath()); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

// Current reports the version `current` points at.
func (l Layout) Current() (string, error) {
	dest, err := os.Readlink(l.CurrentPath())
	if err != nil {
		return "", ErrNoCurrent
	}
	version := strings.TrimPrefix(filepath.Base(dest), l.Name+"-")
	if version == "" || version == filepath.Base(dest) {
		return "", ErrNoCurrent
	}
	return version, nil
}

// Versions lists the installed versions, most recently installed first.
// Install time is what the layout knows; which version is newer in a version
// ordering is the caller's business, and the caller always knows it from the
// manifest it just verified.
func (l Layout) Versions() ([]string, error) {
	entries, err := os.ReadDir(l.Dir)
	if err != nil {
		return nil, err
	}
	type row struct {
		version string
		modTime int64
	}
	var rows []row
	prefix := l.Name + "-"
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), prefix) {
			continue
		}
		info, err := e.Info()
		if err != nil || info.Mode()&os.ModeSymlink != 0 {
			continue
		}
		rows = append(rows, row{strings.TrimPrefix(e.Name(), prefix), info.ModTime().UnixNano()})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].modTime != rows[j].modTime {
			return rows[i].modTime > rows[j].modTime
		}
		return rows[i].version > rows[j].version
	})
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.version)
	}
	return out, nil
}

// Prune deletes every installed version except the ones named — in practice
// the running one and the one a rollback would return to. Naming them is the
// caller's job because only it knows which is which; a heuristic here would
// be the one that deletes the version you are about to need. It also empties
// the staging directory, which holds nothing worth keeping.
func (l Layout) Prune(keep ...string) error {
	versions, err := l.Versions()
	if err != nil {
		return err
	}
	keepSet := map[string]bool{}
	for _, v := range keep {
		keepSet[v] = true
	}
	var errs []error
	for _, v := range versions {
		if keepSet[v] {
			continue
		}
		path, err := l.VersionPath(v)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if err := os.Remove(path); err != nil {
			errs = append(errs, err)
		}
	}
	if err := l.ClearStaging(); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

// ClearStaging removes every partial download.
func (l Layout) ClearStaging() error {
	if err := os.RemoveAll(l.StagingDir()); err != nil {
		return err
	}
	return os.MkdirAll(l.StagingDir(), 0o700)
}
