package selfupdate

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// ErrTreeMember is an archive member under the tree that UnpackTree will not
// write: a link, a device, or a path that climbs out of it.
var ErrTreeMember = errors.New("selfupdate: archive member is not a plain file or directory")

// UnpackTree extracts the directory named root out of a .tar.gz into dest,
// which becomes that directory: a macOS app bundle, say, which is a tree and
// not one file. root is matched as a path component, so
// `runner_1.2.3_darwin_arm64/Runner.app/Contents/...` unpacks with root
// `Runner.app`. Only regular files and directories are written; a link
// anywhere under root fails the whole unpack, because a bundle that points
// outside itself is not one the signature covers. Files keep their owner
// execute bit and lose everything else (0700 or 0600, directories 0700).
//
// On any failure dest is removed, as Fetch removes a bad download.
func UnpackTree(archivePath, root, dest string) (err error) {
	f, err := os.Open(archivePath) //nolint:gosec // archivePath is the file this package just wrote and verified
	if err != nil {
		return err
	}
	defer f.Close() //nolint:errcheck // read-only
	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("selfupdate: open archive: %w", err)
	}
	defer gz.Close() //nolint:errcheck // read-only

	if err := os.MkdirAll(dest, 0o700); err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = os.RemoveAll(dest)
		}
	}()

	var (
		prefix  string
		written int64
	)
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("selfupdate: read archive: %w", err)
		}
		name := path.Clean(strings.TrimPrefix(hdr.Name, "./"))
		if prefix == "" {
			prefix = treePrefix(name, root)
			if prefix == "" {
				continue
			}
		}
		if name != prefix && !strings.HasPrefix(name, prefix+"/") {
			continue
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(name, prefix), "/")
		if rel == ".." || strings.HasPrefix(rel, "../") {
			return fmt.Errorf("%w: %s", ErrTreeMember, hdr.Name)
		}
		target := filepath.Join(dest, filepath.FromSlash(rel))
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o700); err != nil {
				return err
			}
		case tar.TypeReg:
			if rel == "" {
				return fmt.Errorf("%w: %s is a file, not a directory", ErrTreeMember, hdr.Name)
			}
			n, err := writeTreeFile(tr, target, hdr.FileInfo().Mode(), maxArtifact-written)
			written += n
			if err != nil {
				return err
			}
		default:
			return fmt.Errorf("%w: %s", ErrTreeMember, hdr.Name)
		}
	}
	if prefix == "" {
		return fmt.Errorf("%w: %s", ErrMemberAbsent, root)
	}
	return nil
}

// treePrefix is name up to and including its first component equal to root,
// or "" when it has none.
func treePrefix(name, root string) string {
	parts := strings.Split(name, "/")
	for i, part := range parts {
		if part == root {
			return strings.Join(parts[:i+1], "/")
		}
	}
	return ""
}

func writeTreeFile(r io.Reader, target string, mode os.FileMode, budget int64) (int64, error) {
	if budget <= 0 {
		return 0, ErrSize
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return 0, err
	}
	perm := os.FileMode(0o600)
	if mode&0o100 != 0 {
		perm = 0o700
	}
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, perm) //nolint:gosec // target is under the caller's staging directory
	if err != nil {
		return 0, err
	}
	n, err := io.Copy(out, io.LimitReader(r, budget+1))
	if closeErr := out.Close(); err == nil {
		err = closeErr
	}
	if err == nil && n > budget {
		err = ErrSize
	}
	return n, err
}
