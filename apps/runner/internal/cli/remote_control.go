package cli

import (
	"io"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// RemoteControlShow prints whether Claude Code sessions here are reachable
// from the Claude app too (`runner remote-control`).
func (a *App) RemoteControlShow(out io.Writer) error {
	policy, err := a.Host.RemoteControlPolicy()
	if err != nil {
		return err
	}
	p := newPrinter(out)
	if policy.Enabled {
		p.printf("remote control: on\n")
		p.printf("                Claude Code sessions started from now on also open in the Claude app and on claude.ai/code\n")
	} else {
		p.printf("remote control: off\n")
		p.printf("                Claude Code sessions are reached from the console only (runner remote-control on)\n")
	}
	if account := a.Host.ClaudeAccount(); account != "" {
		p.printf("account:        %s\n", account)
	} else {
		p.printf("account:        none: claude is not signed in to a claude.ai account here, so Claude Code registers nothing\n")
	}
	p.printf("file:           %s\n", a.Paths.RemoteControlPolicy())
	return p.err
}

// RemoteControlSet turns it on or off (`runner remote-control on|off`). A
// session takes it at its next launch or restart; one already running keeps
// how it started.
func (a *App) RemoteControlSet(out io.Writer, enabled bool) error {
	if err := a.Host.SetRemoteControlPolicy(hostdomain.RemoteControlPolicy{Enabled: enabled}); err != nil {
		return err
	}
	return a.RemoteControlShow(out)
}
