package app_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

type remoteControlFile struct{ saved *domain.RemoteControlPolicy }

func (f *remoteControlFile) Load() (domain.RemoteControlPolicy, error) {
	if f.saved == nil {
		return domain.RemoteControlPolicy{}, nil
	}
	return *f.saved, nil
}

func (f *remoteControlFile) Save(policy domain.RemoteControlPolicy) error {
	f.saved = &policy
	return nil
}

// A `claude` that does not take `--remote-control` exits on it, so turning
// the switch on for one would fail every Claude Code session on the host.
// The switch asks the installed CLI first and stays off when it says no or
// cannot be asked; turning it off never asks. The regression: an old CLI
// (agent updates off) and a switch that reads "on" while nothing starts.
func TestRemoteControlTurnsOnOnlyForAClaudeThatTakesTheFlag(t *testing.T) {
	ctx := context.Background()
	for _, c := range []struct {
		name string
		help func(context.Context) (string, error)
		on   bool
	}{
		{"takes it", func(context.Context) (string, error) { return "  --remote-control [name]  Start…", nil }, true},
		{"too old", func(context.Context) (string, error) { return "  --resume [value]  Resume…", nil }, false},
		{"not installed", func(context.Context) (string, error) { return "", errors.New("executable file not found") }, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			file := &remoteControlFile{}
			svc := app.New(app.Options{RemoteControlPolicies: file, ClaudeHelp: c.help})
			err := svc.SetRemoteControlPolicy(ctx, domain.RemoteControlPolicy{Enabled: true})
			if got, _ := svc.RemoteControlPolicy(); got.Enabled != c.on || (err == nil) != c.on {
				t.Fatalf("on = %v, err = %v; want on = %v", got.Enabled, err, c.on)
			}
		})
	}

	asked := false
	file := &remoteControlFile{saved: &domain.RemoteControlPolicy{Enabled: true}}
	svc := app.New(app.Options{RemoteControlPolicies: file, ClaudeHelp: func(context.Context) (string, error) {
		asked = true
		return "", errors.New("gone")
	}})
	if err := svc.SetRemoteControlPolicy(ctx, domain.RemoteControlPolicy{}); err != nil || asked {
		t.Fatalf("turning it off: err = %v, asked claude = %v", err, asked)
	}
}
