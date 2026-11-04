package binaries

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

// The macOS layout. macOS grants a permission (Documents, Full Disk Access,
// the local network) to a program's identity: for a bundle, its identifier
// and the team that signed it, at the path it ran from. A bare binary in a
// new file per version is a new program on every update, which is why the
// runner ships as a bundle there and why the bundle that runs never moves:
//
//	<dir>/OppenheimerRunner.app        the live bundle, always this path
//	<dir>/runner-<version>.app         one per installed version, for rollback
//	<dir>/current -> OppenheimerRunner.app/Contents/MacOS/runner
//
// Activating a version copies its bundle into staging and swaps the copy with
// the live one in one rename (swap_*.go), so there is no instant without a
// live bundle and the versioned copies stay what they were installed as.
// `current` is the same link before and after, so the service unit and the
// shim on PATH never change.

// ErrNotABundle is a directory promoted as a bundle that has no executable
// where a bundle keeps it.
var ErrNotABundle = errors.New("binaries: not an app bundle")

func (s *Store) livePath() string { return filepath.Join(s.layout.Dir, s.bundle) }

// liveLink is what `current` holds when it points into the live bundle.
func (s *Store) liveLink() string {
	return filepath.Join(s.bundle, "Contents", "MacOS", s.layout.Name)
}

func (s *Store) bundleExecutable(dir string) string {
	return filepath.Join(dir, "Contents", "MacOS", s.layout.Name)
}

func (s *Store) versionBundle(version string) (string, error) {
	path, err := s.layout.VersionPath(version)
	if err != nil {
		return "", err
	}
	return path + ".app", nil
}

func (s *Store) linksLive() bool {
	dest, err := os.Readlink(s.layout.CurrentPath())
	return err == nil && dest == s.liveLink()
}

// BundleOf is the app bundle an executable runs from, when its path is
// `<name>.app/Contents/MacOS/<executable>`.
func BundleOf(executable string) (string, bool) {
	macOS := filepath.Dir(executable)
	contents := filepath.Dir(macOS)
	root := filepath.Dir(contents)
	if filepath.Base(macOS) != "MacOS" || filepath.Base(contents) != "Contents" || filepath.Ext(root) != ".app" {
		return "", false
	}
	return root, true
}

// liveVersion is the live bundle's CFBundleVersion, which release.sh sets to
// the release's version.
func (s *Store) liveVersion() (string, error) {
	f, err := os.Open(filepath.Join(s.livePath(), "Contents", "Info.plist"))
	if err != nil {
		return "", selfupdate.ErrNoCurrent
	}
	defer f.Close() //nolint:errcheck // read-only

	version, err := plistString(f, "CFBundleVersion")
	if err != nil || version == "" {
		return "", selfupdate.ErrNoCurrent
	}
	if _, err := s.layout.VersionPath(version); err != nil {
		return "", err
	}
	return version, nil
}

// plistString reads a string value of the top-level dictionary of an XML
// property list.
func plistString(r io.Reader, key string) (string, error) {
	dec := xml.NewDecoder(r)
	depth, last := 0, ""
	for {
		tok, err := dec.Token()
		if err != nil {
			return "", err
		}
		start, ok := tok.(xml.StartElement)
		if !ok {
			if end, ok := tok.(xml.EndElement); ok && end.Name.Local == "dict" {
				depth--
			}
			continue
		}
		switch start.Name.Local {
		case "dict":
			depth++
			continue
		case "key", "string":
		default:
			if depth == 1 {
				last = ""
			}
			continue
		}
		var text string
		if err := dec.DecodeElement(&text, &start); err != nil {
			return "", err
		}
		if depth != 1 {
			continue
		}
		if start.Name.Local == "key" {
			last = text
			continue
		}
		if last == key {
			return strings.TrimSpace(text), nil
		}
		last = ""
	}
}

// stageBundle unpacks the archive's bundle into a fresh staging directory.
// selfupdate.ErrMemberAbsent means the archive has no bundle in it.
func (s *Store) stageBundle(archive, version string) (string, error) {
	if err := os.MkdirAll(s.layout.StagingDir(), 0o700); err != nil {
		return "", err
	}
	staged, err := os.MkdirTemp(s.layout.StagingDir(), "runner-"+sanitize(version)+"-*.app")
	if err != nil {
		return "", err
	}
	if err := selfupdate.UnpackTree(archive, s.bundle, staged); err != nil {
		_ = os.RemoveAll(staged)
		return "", err
	}
	if _, err := os.Stat(s.bundleExecutable(staged)); err != nil {
		_ = os.RemoveAll(staged)
		return "", fmt.Errorf("%w: the release's %s has no Contents/MacOS/%s", ErrNotABundle, s.bundle, s.layout.Name)
	}
	return staged, nil
}

// promoteBundle moves a staged bundle in as a version. A version installed
// again (the reinstall NeedsReinstall asks for) replaces its old copy.
func (s *Store) promoteBundle(staged, version string) error {
	target, err := s.versionBundle(version)
	if err != nil {
		return err
	}
	if _, err := os.Stat(s.bundleExecutable(staged)); err != nil {
		return fmt.Errorf("%w: %s", ErrNotABundle, staged)
	}
	if err := os.RemoveAll(target); err != nil {
		return err
	}
	return os.Rename(staged, target)
}

// activateBundle makes dir's bundle the live one and points `current` into it.
func (s *Store) activateBundle(dir string) error {
	tmp, err := os.MkdirTemp(s.layout.StagingDir(), "live-*.app")
	if err != nil {
		return err
	}
	if err := copyTree(dir, tmp); err != nil {
		_ = os.RemoveAll(tmp)
		return err
	}
	live := s.livePath()
	if _, err := os.Lstat(live); errors.Is(err, fs.ErrNotExist) {
		if err := os.Rename(tmp, live); err != nil {
			_ = os.RemoveAll(tmp)
			return err
		}
	} else {
		if err := swap(tmp, live); err != nil {
			_ = os.RemoveAll(tmp)
			return fmt.Errorf("swap in the new bundle: %w", err)
		}
		// tmp now holds the bundle that was live.
		_ = os.RemoveAll(tmp)
	}
	if s.linksLive() {
		return nil
	}
	link := filepath.Join(s.layout.Dir, ".current.live")
	_ = os.Remove(link)
	if err := os.Symlink(s.liveLink(), link); err != nil {
		return err
	}
	if err := os.Rename(link, s.layout.CurrentPath()); err != nil {
		_ = os.Remove(link)
		return err
	}
	return nil
}

// pruneBundles deletes every versioned bundle except the ones named.
func (s *Store) pruneBundles(keep ...string) error {
	keepSet := map[string]bool{}
	for _, v := range keep {
		if dir, err := s.versionBundle(v); err == nil {
			keepSet[filepath.Base(dir)] = true
		}
	}
	entries, err := os.ReadDir(s.layout.Dir)
	if err != nil {
		return err
	}
	var errs []error
	prefix := s.layout.Name + "-"
	for _, e := range entries {
		name := e.Name()
		if !e.IsDir() || keepSet[name] || filepath.Ext(name) != ".app" || len(name) <= len(prefix) || name[:len(prefix)] != prefix {
			continue
		}
		if err := os.RemoveAll(filepath.Join(s.layout.Dir, name)); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// copyTree copies a bundle of plain files and directories, keeping each
// file's mode. A link inside it is refused, as UnpackTree refuses one.
func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		switch {
		case d.IsDir():
			return os.MkdirAll(target, 0o700)
		case d.Type().IsRegular():
			return copyFile(path, target)
		default:
			return fmt.Errorf("%w: %s is not a plain file", ErrNotABundle, path)
		}
	})
}

func copyFile(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	in, err := os.Open(src) //nolint:gosec // a file in this host's own layout
	if err != nil {
		return err
	}
	defer in.Close() //nolint:errcheck // read-only

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_EXCL, info.Mode().Perm()) //nolint:gosec // dst is under staging
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	return out.Close()
}
