// Package memory is an in-process ControlPlane: the default in tests, and the
// reason pairing can be exercised without a control plane.
package memory

import (
	"context"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
)

var _ app.ControlPlane = (*ControlPlane)(nil)

// ControlPlane records what it was asked and answers what you set.
type ControlPlane struct {
	mu       sync.Mutex
	Response app.RegisterResponse
	Err      error
	Requests []app.RegisterRequest
	Revoked  []string
	// RevokeErr is what Revoke answers, for the control plane that could not
	// be reached during an uninstall.
	RevokeErr error
}

// New returns a control plane that accepts one registration.
func New() *ControlPlane {
	return &ControlPlane{Response: app.RegisterResponse{
		HostID:      "host_01HZ",
		Fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		Channel:     string(domain.ChannelStable),
	}}
}

// Register implements app.ControlPlane.
func (c *ControlPlane) Register(_ context.Context, _ string, req app.RegisterRequest) (app.RegisterResponse, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Requests = append(c.Requests, req)
	if c.Err != nil {
		return app.RegisterResponse{}, c.Err
	}
	return c.Response, nil
}

// Revoke implements app.ControlPlane.
func (c *ControlPlane) Revoke(_ context.Context, _, assertion string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Revoked = append(c.Revoked, assertion)
	return c.RevokeErr
}
