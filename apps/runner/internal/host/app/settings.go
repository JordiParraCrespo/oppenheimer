package app

import (
	"slices"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// Settings is what this host lets bots do: its browser, its screen and its
// exec policy, as the three files `runner browser`, `runner computer` and
// `runner exec` keep hold them.
type Settings struct {
	Browser  bool
	Computer bool
	Exec     domain.ExecPolicy
}

// SettingsChange is what a bot asked to change for the person
// (`host.settings.set`, 25 §4.2): a nil field is left as it is, and Allow
// only adds to the allowlist.
type SettingsChange struct {
	Browser  *bool
	Computer *bool
	ExecMode *domain.ExecMode
	Allow    []string
}

// Settings reads the three switches as they are enforced.
func (s *Service) Settings() (Settings, error) {
	browser, err := s.BrowserPolicy()
	if err != nil {
		return Settings{}, err
	}
	computer, err := s.ComputerPolicy()
	if err != nil {
		return Settings{}, err
	}
	exec, err := s.ExecPolicy()
	if err != nil {
		return Settings{}, err
	}
	return Settings{Browser: browser.Enabled, Computer: computer.Enabled, Exec: exec}, nil
}

// ApplySettings writes the change, the same way the `runner` commands do,
// and answers with the switches after it. Every entry is checked before any
// file is written, so a bad entry changes nothing.
func (s *Service) ApplySettings(change SettingsChange) (Settings, error) {
	for _, entry := range change.Allow {
		if err := domain.ValidExecEntry(entry); err != nil {
			return Settings{}, domain.ErrExecEntry.WithDetail("%v", err).WithCause(err)
		}
	}
	if change.ExecMode != nil && !slices.Contains(domain.ExecModes, *change.ExecMode) {
		return Settings{}, domain.ErrExecEntry.WithDetail("unknown exec mode %q", *change.ExecMode)
	}
	if change.Browser != nil {
		if err := s.SetBrowserPolicy(domain.BrowserPolicy{Enabled: *change.Browser}); err != nil {
			return Settings{}, err
		}
	}
	if change.Computer != nil {
		if err := s.SetComputerPolicy(domain.ComputerPolicy{Enabled: *change.Computer}); err != nil {
			return Settings{}, err
		}
	}
	if change.ExecMode != nil || len(change.Allow) > 0 {
		policy, err := s.ExecPolicy()
		if err != nil {
			return Settings{}, err
		}
		if change.ExecMode != nil {
			policy.Mode = *change.ExecMode
		}
		for _, entry := range change.Allow {
			if !slices.Contains(policy.Allow, entry) {
				policy.Allow = append(policy.Allow, entry)
			}
		}
		if err := s.SetExecPolicy(policy); err != nil {
			return Settings{}, err
		}
	}
	return s.Settings()
}
