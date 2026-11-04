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
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
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
	bundle  string
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
	// Bundle names the macOS app bundle the release archive carries
	// (`OppenheimerRunner.app`). When set, versions are installed as bundles
	// and the one that runs is a copy of one at a single fixed path
	// (bundle.go); a release without the bundle still installs as a bare
	// binary. Empty on Linux.
	Bundle string
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
	return &Store{layout: layout, http: httpClient, member: member, timeout: selfCheckTimeout, bundle: opts.Bundle}, nil
}

// CurrentPath is the stable path the service unit executes.
func (s *Store) CurrentPath() string { return s.layout.CurrentPath() }

// Stage downloads the artifact, checks its digest against the signed
// manifest, and unpacks the binary. Nothing here is executed and nothing is
// activated; a failure leaves nothing of its own in the staging directory.
//
// Every stage writes to names of its own. The daemon serialises its applies,
// but `runner update` is another process: two stages of one version sharing a
// file would truncate and interleave each other's download.
func (s *Store) Stage(ctx context.Context, artifact domain.Artifact, version string) (string, error) {
	archive, err := s.stagingFile("runner-" + sanitize(version) + "-*.tar.gz")
	if err != nil {
		return "", domain.ErrArtifact.WithDetail("prepare the staging directory: %v", err).WithCause(err)
	}
	// The archive is only the way to the binary; it goes whatever happens.
	defer os.Remove(archive) //nolint:errcheck // Prune clears staging anyway
	err = selfupdate.Fetch(ctx, s.http, selfupdate.Artifact{
		URL: artifact.URL, SHA256: artifact.SHA256, Size: artifact.Size,
	}, archive)
	switch {
	case errors.Is(err, selfupdate.ErrDigest):
		return "", domain.ErrArtifact.WithDetail(
			"the download from %s does not match the digest in the signed manifest; it was deleted", artifact.URL).WithCause(err)
	case err != nil:
		return "", domain.ErrArtifact.WithDetail("%s: %v", artifact.URL, err).WithCause(err)
	}

	if s.bundle != "" {
		staged, err := s.stageBundle(archive, version)
		if err == nil || !errors.Is(err, selfupdate.ErrMemberAbsent) {
			return staged, err
		}
		// A release from before the bundle: install its bare binary.
	}
	staged, err := s.stagingFile("runner-" + sanitize(version) + "-*")
	if err != nil {
		return "", domain.ErrArtifact.WithDetail("prepare the staging directory: %v", err).WithCause(err)
	}
	if err := selfupdate.Unpack(archive, s.member, staged); err != nil {
		_ = os.Remove(staged)
		return "", domain.ErrArtifact.WithDetail("%v", err).WithCause(err)
	}
	return staged, nil
}

// stagingFile reserves a fresh, empty file in the staging directory, named
// after pattern as os.CreateTemp names it.
func (s *Store) stagingFile(pattern string) (string, error) {
	if err := os.MkdirAll(s.layout.StagingDir(), 0o700); err != nil {
		return "", err
	}
	f, err := os.CreateTemp(s.layout.StagingDir(), pattern)
	if err != nil {
		return "", err
	}
	name := f.Name()
	if err := f.Close(); err != nil {
		_ = os.Remove(name)
		return "", err
	}
	return name, nil
}

// SelfCheck runs the staged binary's own `selfcheck`. This is the step that
// catches a wrong-arch or truncated build while the old binary is still the
// service — the difference between a failed update and a dead host.
func (s *Store) SelfCheck(ctx context.Context, path string) error {
	if info, err := os.Stat(path); err == nil && info.IsDir() {
		path = s.bundleExecutable(path)
	}
	res, err := execx.Run(ctx, execx.Spec{
		Name: path, Args: []string{"selfcheck"}, Timeout: s.timeout, Output: execx.Combined,
	})
	if err != nil {
		detail := strings.TrimSpace(res.Out)
		if detail == "" {
			detail = execx.Cause(err).Error()
		}
		return fmt.Errorf("%s selfcheck: %s", filepath.Base(path), detail)
	}
	return nil
}

// Promote moves a staged binary, or a staged bundle, in as a version.
func (s *Store) Promote(stagedPath, version string) error {
	if info, err := os.Stat(stagedPath); err == nil && info.IsDir() && s.bundle != "" {
		return s.promoteBundle(stagedPath, version)
	}
	_, err := s.layout.Promote(stagedPath, version)
	return err
}

// Activate points `current` at an installed version. On macOS a version
// installed as a bundle is copied in as the live bundle, and `current` points
// into that; a version installed as a bare binary is linked as on Linux.
func (s *Store) Activate(version string) error {
	if s.bundle != "" {
		if dir, err := s.versionBundle(version); err == nil {
			if info, err := os.Stat(dir); err == nil && info.IsDir() {
				return s.activateBundle(dir)
			}
		}
	}
	return s.layout.Activate(version)
}

// ActivateBinary points `current` at a version's bare binary, bundle or not.
func (s *Store) ActivateBinary(version string) error { return s.layout.Activate(version) }

// Current is the version `current` points at.
func (s *Store) Current() (string, error) {
	if s.bundle != "" && s.linksLive() {
		return s.liveVersion()
	}
	return s.layout.Current()
}

// NeedsReinstall reports that the version running here is not installed the
// way this platform runs it: on macOS, a bare binary rather than the bundle,
// as a host updated by a runner from before the bundle is. Its permissions
// would be lost on every update, so the same version is worth installing
// again from the release.
func (s *Store) NeedsReinstall() bool { return s.bundle != "" && !s.linksLive() }

// Prune keeps the named versions and clears staging.
func (s *Store) Prune(keep ...string) error {
	err := s.layout.Prune(keep...)
	if s.bundle == "" {
		return err
	}
	return errors.Join(err, s.pruneBundles(keep...))
}

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
