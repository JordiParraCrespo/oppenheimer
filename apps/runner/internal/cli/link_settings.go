package cli

// `host.settings.set`: a bot changes this host's browser, screen or exec
// switch because the person asked it to (product/design/bots/bots.md §4.2, "The host's switches"),
// writing the same files `runner browser`, `runner computer` and `runner
// exec` do. Answered with `host.settings`, what the host now allows, or
// `command.failed` with the code of the file that could not be written.

import (
	hostapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// laneSettings is one lane for the host: two changes write the same files in
// the order they were sent.
const laneSettings = "settings"

func (h *linkHandler) setSettings(m link.HostSettingsSet) {
	change := hostapp.SettingsChange{Allow: m.ExecAllow}
	if on, ok := switchState(m.Browser); ok {
		change.Browser = &on
	}
	if on, ok := switchState(m.Computer); ok {
		change.Computer = &on
	}
	if m.ExecMode != "" {
		mode, err := hostdomain.ParseExecMode(m.ExecMode)
		if err != nil {
			h.fail(m.CommandID, hostdomain.ErrExecEntry.WithDetail("%v", err).WithCause(err))
			return
		}
		change.ExecMode = &mode
	}
	settings, err := h.app.Host.ApplySettings(change)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	allow := settings.Exec.Allow
	if allow == nil {
		allow = []string{}
	}
	_ = h.client.Send(link.HostSettings{
		Type: link.TypeHostSettings, CommandID: m.CommandID,
		Browser: switchWord(settings.Browser), Computer: switchWord(settings.Computer),
		ExecMode: string(settings.Exec.Mode), ExecAllow: allow,
	})
}

// switchState reads "on" or "off"; anything else leaves the switch alone.
func switchState(value string) (on, given bool) {
	switch value {
	case "on":
		return true, true
	case "off":
		return false, true
	}
	return false, false
}

func switchWord(on bool) string {
	if on {
		return "on"
	}
	return "off"
}
