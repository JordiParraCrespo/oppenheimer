// Package binaries is the versioned binary directory on disk, on top of
// packages/go/selfupdate. It owns the sequence a new version goes through —
// download, verify, unpack, self-check, promote, activate — and nothing about
// when to do it.
package binaries

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

var _ app.Binaries = (*Store)(nil)

// selfCheckTimeout bounds the staged binary's own check. It parses a config
// and prints a version; a binary that needs longer is already a problem.
const selfCheckTimeout = 20 * time.Second

// Store is the layout plus the HTTP client that fills it.
type Store struct {
	layout  selfupdate.Layout
	http    *http.Client
	member  string
	timeout time.Duration
}

// Options configure the store.
type Options struct {
	// Dir is the versioned binary directory (~/.oppenheimer/bin).
	Dir string
	// Name is the binary's base name, used for `<name>-<version>`.
	Name string
	HTTP *http.Client
	// Member is the file to take out of the release archive.
	Member string
}

// New builds the store and creates its directories 0700.
func New(opts Options) (*Store, error) {
	name := opts.Name
	if name == "" {
		name = "runner"
	}
	layout, err := selfupdate.NewLayout(opts.Dir, name)
	if err != nil {
		return nil, err
	}
	httpClient := opts.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Minute}
	}
	member := opts.Member
	if member == "" {
		member = name
	}
	return &Store{layout: layout, http: httpClient, member: member, timeout: selfCheckTimeout}, nil
}

// CurrentPath is the stable path the service unit executes.
func (s *Store) CurrentPath() string { return s.layout.CurrentPath() }

// Stage downloads the artifact, checks its digest against the signed
// manifest, and unpacks the binary. Nothing here is executed and nothing is
// activated; a failure leaves the staging directory empty.
func (s *Store) Stage(ctx context.Context, artifact domain.Artifact, version string) (string, error) {
	archive := filepath.Join(s.layout.StagingDir(), "runner-"+sanitize(version)+".tar.gz")
	err := selfupdate.Fetch(ctx, s.http, selfupdate.Artifact{
		URL: artifact.URL, SHA256: artifact.SHA256, Size: artifact.Size,
	}, archive)
	switch {
	case errors.Is(err, selfupdate.ErrDigest):
		return "", domain.ErrArtifact.WithDetail(
			"the download from %s does not match the digest in the signed manifest; it was deleted", artifact.URL).WithCause(err)
	case err != nil:
		return "", domain.ErrArtifact.WithDetail("%s: %v", artifact.URL, err).WithCause(err)
	}

	staged := filepath.Join(s.layout.StagingDir(), "runner-"+sanitize(version))
	if err := selfupdate.Unpack(archive, s.member, staged); err != nil {
		return "", domain.ErrArtifact.WithDetail("%v", err).WithCause(err)
	}
	return staged, nil
}

// SelfCheck runs the staged binary's own `selfcheck`. This is the step that
// catches a wrong-arch or truncated build while the old binary is still the
// service — the difference between a failed update and a dead host.
func (s *Store) SelfCheck(ctx context.Context, path string) error {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, path, "selfcheck").CombinedOutput()
	if err != nil {
		detail := strings.TrimSpace(string(out))
		if detail == "" {
			detail = err.Error()
		}
		return fmt.Errorf("%s selfcheck: %s", filepath.Base(path), detail)
	}
	return nil
}

// Promote moves a staged binary in as a version.
func (s *Store) Promote(stagedPath, version string) error {
	_, err := s.layout.Promote(stagedPath, version)
	return err
}

// Activate points `current` at an installed version.
func (s *Store) Activate(version string) error { return s.layout.Activate(version) }

// Current is the version `current` points at.
func (s *Store) Current() (string, error) { return s.layout.Current() }

// Prune keeps the named versions and clears staging.
func (s *Store) Prune(keep ...string) error { return s.layout.Prune(keep...) }

// sanitize keeps a version usable as a file name; the layout rejects anything
// unsafe, and this keeps the staging name readable in the meantime.
func sanitize(version string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '-', r == '_':
			return r
		default:
			return '_'
		}
	}, version)
}
