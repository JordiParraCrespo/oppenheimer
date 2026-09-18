// Package release fetches the signed manifest from the release server and
// turns it into the policy's Release. Verification happens here, at the edge:
// nothing downstream ever sees a manifest that was not signed by the offline
// key compiled into this binary.
package release

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/selfupdate"
)

var _ app.Releases = (*Client)(nil)

// maxManifest caps the manifest body; a real one is a few hundred bytes.
const maxManifest = 1 << 20

// Client reads `<base>/<channel>.json` and `<base>/<channel>.json.sig`.
type Client struct {
	baseURL string
	target  string
	http    *http.Client
	keys    string
}

// Options configure the client.
type Options struct {
	// BaseURL is the release host from the host's identity. It is pinned
	// there at registration, so a control plane cannot point a host at a
	// different download server later.
	BaseURL string
	// Target overrides `os/arch`, for tests.
	Target string
	HTTP   *http.Client
	// Keys overrides the compiled-in key block, for tests.
	Keys string
}

// New builds the client.
func New(opts Options) *Client {
	httpClient := opts.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	target := opts.Target
	if target == "" {
		target = selfupdate.CurrentTarget()
	}
	keys := opts.Keys
	if keys == "" {
		keys = PublicKeys
	}
	return &Client{baseURL: strings.TrimRight(opts.BaseURL, "/"), target: target, http: httpClient, keys: keys}
}

// Fetch downloads the channel's manifest and its detached signature, verifies
// one against the other, and narrows it to this host's target.
func (c *Client) Fetch(ctx context.Context, channel string) (domain.Release, error) {
	keys, err := selfupdate.ParsePublicKeys(c.keys)
	if err != nil {
		return domain.Release{}, domain.ErrNoSigningKey.WithDetail("%v", err).WithCause(err)
	}
	if len(keys) == 0 {
		return domain.Release{}, domain.ErrNoSigningKey.WithDetail(
			"this build was made without a release key, so it will not install any update; " +
				"upgrade it with the install command from Settings → Add host")
	}
	if c.baseURL == "" {
		return domain.Release{}, domain.ErrManifest.WithDetail("this host has no release URL in its config")
	}
	if channel == "" {
		channel = "stable"
	}
	if strings.ContainsAny(channel, "/.\\") {
		return domain.Release{}, domain.ErrManifest.WithDetail("%q is not a channel name", channel)
	}

	manifestURL := c.baseURL + "/" + url.PathEscape(channel) + ".json"
	raw, err := c.get(ctx, manifestURL, maxManifest)
	if err != nil {
		return domain.Release{}, domain.ErrManifest.WithDetail("%s: %v", manifestURL, err).WithCause(err)
	}
	signature, err := c.get(ctx, manifestURL+".sig", 4096)
	if err != nil {
		return domain.Release{}, domain.ErrManifest.WithDetail("%s.sig: %v", manifestURL, err).WithCause(err)
	}

	manifest, err := selfupdate.ParseManifest(raw, string(signature), keys)
	if err != nil {
		switch {
		case errors.Is(err, selfupdate.ErrSignature):
			return domain.Release{}, domain.ErrManifest.WithDetail(
				"the manifest at %s is not signed by a key this runner trusts; nothing was downloaded", manifestURL).WithCause(err)
		default:
			return domain.Release{}, domain.ErrManifest.WithDetail("%v", err).WithCause(err)
		}
	}

	artifact, err := manifest.Artifact(c.target)
	if err != nil {
		return domain.Release{}, domain.ErrNoTarget.WithDetail(
			"release %s has no build for %s", manifest.Version, c.target).WithCause(err)
	}
	artifactURL, err := absolute(c.baseURL, artifact.URL)
	if err != nil {
		return domain.Release{}, domain.ErrManifest.WithDetail("%v", err).WithCause(err)
	}
	return domain.Release{
		Channel:      manifest.Channel,
		Version:      manifest.Version,
		MinSupported: manifest.MinSupported,
		Notes:        manifest.Notes,
		Urgent:       manifest.Urgent,
		Artifact:     domain.Artifact{URL: artifactURL, SHA256: artifact.SHA256, Size: artifact.Size},
	}, nil
}

func (c *Client) get(ctx context.Context, target string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %s", resp.Status)
	}
	return io.ReadAll(io.LimitReader(resp.Body, limit))
}

// absolute resolves a manifest's artifact URL against the release base and
// refuses one that points somewhere else. The digest already makes a foreign
// URL harmless, but a host that only ever talks to its own release server is
// easier to reason about, and to firewall.
func absolute(base, target string) (string, error) {
	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		return base + "/" + strings.TrimPrefix(target, "/"), nil
	}
	artifact, err := url.Parse(target)
	if err != nil {
		return "", fmt.Errorf("artifact URL %q is not a URL: %w", target, err)
	}
	origin, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("release base %q is not a URL: %w", base, err)
	}
	if artifact.Scheme != origin.Scheme || artifact.Host != origin.Host {
		return "", fmt.Errorf("artifact URL %q is not on the release host %q", target, origin.Host)
	}
	return target, nil
}
