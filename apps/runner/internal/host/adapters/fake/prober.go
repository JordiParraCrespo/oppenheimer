// Package fake is an in-memory Prober and Updater: the default in tests and
// the reason nothing in this context needs a Debian box to be exercised.
package fake

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Prober = (*Prober)(nil)

// Prober answers from fields you set.
type Prober struct {
	PlatformName domain.Platform
	OSVersion    string
	Tools        map[string]domain.Tool
	User         string
	Home         string
	Hostname     string
	Root         bool
	Free         uint64
	Total        uint64
	MachineFacts domain.Machine
	PlatformErr  error
	// Calls records "invalidate" and "tool:<name>" in order, so a test can
	// tell a fresh probe from a cached one.
	Calls []string
}

// New returns a healthy Ubuntu host with git and tmux present.
func New() *Prober {
	return &Prober{
		PlatformName: domain.PlatformUbuntu,
		OSVersion:    "24.04",
		Tools: map[string]domain.Tool{
			domain.ToolGit:  {Path: "/usr/bin/git", Version: "git version 2.43.0"},
			domain.ToolTmux: {Path: "/usr/bin/tmux", Version: "tmux 3.4"},
		},
		User: "jordi", Home: "/home/jordi", Hostname: "hetzner-box",
		Free: 64 << 30,
	}
}

// Platform implements app.Prober.
func (p *Prober) Platform(context.Context) (domain.Platform, string, error) {
	return p.PlatformName, p.OSVersion, p.PlatformErr
}

// Tool implements app.Prober.
func (p *Prober) Tool(_ context.Context, name string) domain.Tool {
	p.Calls = append(p.Calls, "tool:"+name)
	return p.Tools[name]
}

// Invalidate implements app.Prober.
func (p *Prober) Invalidate() { p.Calls = append(p.Calls, "invalidate") }

// Identity implements app.Prober.
func (p *Prober) Identity() (string, string, string, bool) {
	return p.User, p.Home, p.Hostname, p.Root
}

// DiskFree implements app.Prober.
func (p *Prober) DiskFree(string) (uint64, error) { return p.Free, nil }

// DiskTotal implements app.Prober.
func (p *Prober) DiskTotal(string) (uint64, error) { return p.Total, nil }

// Machine implements app.Prober.
func (p *Prober) Machine(context.Context) domain.Machine { return p.MachineFacts }
