package selfupdate

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// maxArtifact caps a download whose manifest size is missing or absurd. A
// runner binary is tens of megabytes; this is the ceiling, not the budget.
const maxArtifact = 256 << 20

// Fetch downloads an artifact to dest and returns only once its SHA-256
// matches the manifest. A mismatch leaves nothing behind: the partial file is
// removed, because a half-verified binary on disk is the thing this package
// exists to prevent.
func Fetch(ctx context.Context, client *http.Client, a Artifact, dest string) error {
	if client == nil {
		client = http.DefaultClient
	}
	want, err := hex.DecodeString(strings.TrimSpace(a.SHA256))
	if err != nil || len(want) != sha256.Size {
		return fmt.Errorf("%w: manifest digest is not a sha256", ErrDigest)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.URL, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("selfupdate: download %s: unexpected status %s", a.URL, resp.Status)
	}

	limit := a.Size
	if limit <= 0 || limit > maxArtifact {
		limit = maxArtifact
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o700); err != nil {
		return err
	}
	f, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600) //nolint:gosec // dest is the caller's staging path
	if err != nil {
		return err
	}
	digest := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, digest), io.LimitReader(resp.Body, limit+1))
	closeErr := f.Close()
	switch {
	case copyErr != nil:
		err = copyErr
	case closeErr != nil:
		err = closeErr
	case n > limit:
		err = ErrSize
	case a.Size > 0 && n != a.Size:
		err = fmt.Errorf("%w: got %d bytes, manifest says %d", ErrSize, n, a.Size)
	case subtle.ConstantTimeCompare(digest.Sum(nil), want) != 1:
		err = fmt.Errorf("%w: got %s, manifest says %s", ErrDigest, hex.EncodeToString(digest.Sum(nil)), a.SHA256)
	}
	if err != nil {
		_ = os.Remove(dest)
		return err
	}
	return nil
}

// Unpack extracts one regular file from a .tar.gz into dest with mode 0700,
// the mode a binary about to be executed by its owner needs. Anything else in
// the archive is ignored, and a member path that tries to escape is refused.
func Unpack(archivePath, member, dest string) error {
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

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return fmt.Errorf("%w: %s", ErrMemberAbsent, member)
		}
		if err != nil {
			return fmt.Errorf("selfupdate: read archive: %w", err)
		}
		if hdr.Typeflag != tar.TypeReg || path.Base(path.Clean(hdr.Name)) != member {
			continue
		}
		//nolint:gosec // dest is the caller's staging path, and 0700 is what an executable needs
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o700)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, io.LimitReader(tr, maxArtifact)); err != nil {
			_ = out.Close()
			_ = os.Remove(dest)
			return err
		}
		if err := out.Close(); err != nil {
			_ = os.Remove(dest)
			return err
		}
		// 0700: the file is a binary this user is about to execute.
		return os.Chmod(dest, 0o700) //nolint:gosec // an executable owned by, and readable only by, this user
	}
}

// Digest is the SHA-256 of a file as lowercase hex, for reporting what is
// already on disk.
func Digest(path string) (string, error) {
	f, err := os.Open(path) //nolint:gosec // the caller names a file in its own layout
	if err != nil {
		return "", err
	}
	defer f.Close() //nolint:errcheck // read-only
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
