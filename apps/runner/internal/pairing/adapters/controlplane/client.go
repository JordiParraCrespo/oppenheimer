// Package controlplane is the HTTP client for the registration endpoints. It
// is the only place in this context that knows the control plane speaks JSON
// over HTTPS, and the only place that turns an RFC 7807 response from the
// other side into one of this context's problems.
package controlplane

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

var _ app.ControlPlane = (*Client)(nil)

// Paths on the control plane. The API mounts every route under `/api/v1`, so
// the `--url` flag stays the bare origin (`https://app.oppenheimer.dev`) and
// the prefix lives here (01-protocol.md, 03-control-plane.md).
const (
	registerPath = "/api/v1/hosts/register"
	revokePath   = "/api/v1/hosts/self"
)

// maxResponse caps a reply body; registration answers are a few hundred bytes.
const maxResponse = 1 << 20

// Client talks to the control plane.
type Client struct {
	http      *http.Client
	userAgent string
}

// Options configure the client.
type Options struct {
	HTTP      *http.Client
	UserAgent string
}

// New builds the client. The default timeout is generous enough for a phone
// tethering a laptop and short enough that `runner register` never hangs. A
// supplied client is copied rather than used, because this client decides how
// redirects are handled and a caller's transport is all that is wanted from it.
func New(opts Options) *Client {
	httpClient := &http.Client{Timeout: 30 * time.Second}
	if opts.HTTP != nil {
		copied := *opts.HTTP
		httpClient = &copied
	}
	httpClient.CheckRedirect = refuseCrossOriginRedirect
	ua := opts.UserAgent
	if ua == "" {
		ua = "oppenheimer-runner"
	}
	return &Client{http: httpClient, userAgent: ua}
}

// refuseCrossOriginRedirect keeps the credential on the origin the host was
// paired with. A redirect that changes scheme or host is refused instead of
// followed, so the boot JWT is never offered to a second origin; a redirect
// within the control plane is ordinary and is followed.
func refuseCrossOriginRedirect(req *http.Request, via []*http.Request) error {
	if len(via) == 0 {
		return nil
	}
	origin := via[0].URL
	if req.URL.Scheme != origin.Scheme || req.URL.Host != origin.Host {
		return fmt.Errorf("refused a redirect from %s://%s to %s://%s",
			origin.Scheme, origin.Host, req.URL.Scheme, req.URL.Host)
	}
	return nil
}

// Register redeems a registration token.
func (c *Client) Register(ctx context.Context, baseURL string, req app.RegisterRequest) (app.RegisterResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return app.RegisterResponse{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+registerPath, bytes.NewReader(body))
	if err != nil {
		return app.RegisterResponse{}, domain.ErrControlPlaneURL.WithDetail("%v", err).WithCause(err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return app.RegisterResponse{}, domain.ErrUnreachable.WithDetail(
			"%s: %v", baseURL, err).WithCause(err)
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	payload, _ := io.ReadAll(io.LimitReader(resp.Body, maxResponse))

	if resp.StatusCode/100 != 2 {
		return app.RegisterResponse{}, statusProblem(resp.StatusCode, payload)
	}
	var out app.RegisterResponse
	if err := json.Unmarshal(payload, &out); err != nil {
		return app.RegisterResponse{}, domain.ErrTokenRejected.WithDetail(
			"the control plane answered with something that is not a registration: %v", err).WithCause(err)
	}
	return out, nil
}

// Revoke tells the control plane this host is gone. The boot JWT is the
// bearer, and the host names itself by that token's subject, which is why the
// route is `self` and carries no id. A 404 is the outcome the caller asked
// for: something else already removed the host.
func (c *Client) Revoke(ctx context.Context, baseURL, assertion string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, baseURL+revokePath, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+assertion)
	req.Header.Set("User-Agent", c.userAgent)
	resp, err := c.http.Do(req)
	if err != nil {
		return domain.ErrUnreachable.WithDetail("%s: %v", baseURL, err).WithCause(err)
	}
	defer resp.Body.Close() //nolint:errcheck // read-only body
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxResponse))
	if resp.StatusCode/100 != 2 && resp.StatusCode != http.StatusNotFound {
		return statusProblem(resp.StatusCode, nil)
	}
	return nil
}

// statusProblem maps the other side's answer onto this context's catalog,
// keeping its `detail` when it sent a problem document: the control plane
// knows why a token was refused, and the user needs that sentence.
func statusProblem(status int, payload []byte) error {
	detail := ""
	var doc problem.Details
	if json.Unmarshal(payload, &doc) == nil && doc.Title != "" {
		detail = doc.Title
		if doc.Detail != "" {
			detail = doc.Detail
		}
	}
	switch {
	case status == http.StatusUnauthorized, status == http.StatusForbidden, status == http.StatusGone:
		if detail == "" {
			detail = "the token is expired, already used, or revoked; mint a new one in Settings → Add host"
		}
		return domain.ErrTokenRejected.WithDetail("%s", detail)
	case status == http.StatusConflict:
		return domain.ErrAlreadyRegisted.WithDetail("%s", orDefault(detail, "the control plane already knows this host"))
	case status == http.StatusTooManyRequests:
		// Not a verdict on the token: the throttle answered before the token was
		// looked at, so it is still unspent and the same command works shortly.
		return domain.ErrRateLimited.WithDetail(
			"wait a minute and run the same command again; the token was not spent")
	case status/100 == 5:
		return domain.ErrUnreachable.WithDetail("the control plane answered %d: %s", status, orDefault(detail, "no detail"))
	default:
		return domain.ErrTokenRejected.WithDetail("the control plane answered %d: %s", status, orDefault(detail, "no detail"))
	}
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
