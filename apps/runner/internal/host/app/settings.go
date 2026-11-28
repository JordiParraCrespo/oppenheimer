package app

import (
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
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
// (`host.settings.set`, product/design/bots/bots.md §4.2): a nil field is left as it is, and Allow
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
// and answers with the switches after it. Everything is read and checked
// before anything is written, so a bad entry, a full allowlist or an
// unreadable exec policy changes nothing. A write that fails after an
// earlier one landed says in its detail what was already saved.
func (s *Service) ApplySettings(change SettingsChange) (Settings, error) {
	for _, entry := range change.Allow {
		if err := domain.ValidExecEntry(entry); err != nil {
			return Settings{}, domain.ErrExecEntry.WithDetail("%v; nothing changed", err).WithCause(err)
		}
	}
	if change.ExecMode != nil && !slices.Contains(domain.ExecModes, *change.ExecMode) {
		return Settings{}, domain.ErrExecEntry.WithDetail("unknown exec mode %q; nothing changed", *change.ExecMode)
	}
	var exec *domain.ExecPolicy
	if change.ExecMode != nil || len(change.Allow) > 0 {
		policy, err := s.ExecPolicy()
		if err != nil {
			return Settings{}, nothingChanged(err)
		}
		if change.ExecMode != nil {
			policy.Mode = *change.ExecMode
		}
		for _, entry := range change.Allow {
			if !slices.Contains(policy.Allow, entry) {
				policy.Allow = append(policy.Allow, entry)
			}
		}
		if raw, err := json.MarshalIndent(policy, "", "  "); err != nil || len(raw)+1 > domain.ExecPolicyMaxBytes {
			return Settings{}, domain.ErrExecAllowFull.WithDetail(
				"the list would pass %d bytes; remove entries with `runner exec deny` first. Nothing changed",
				domain.ExecPolicyMaxBytes)
		}
		exec = &policy
	}

	var saved []string
	if change.Browser != nil {
		if err := s.SetBrowserPolicy(domain.BrowserPolicy{Enabled: *change.Browser}); err != nil {
			return Settings{}, partly(err, saved)
		}
		saved = append(saved, "browser "+onOff(*change.Browser))
	}
	if change.Computer != nil {
		if err := s.SetComputerPolicy(domain.ComputerPolicy{Enabled: *change.Computer}); err != nil {
			return Settings{}, partly(err, saved)
		}
		saved = append(saved, "screen "+onOff(*change.Computer))
	}
	if exec != nil {
		if err := s.SetExecPolicy(*exec); err != nil {
			return Settings{}, partly(err, saved)
		}
	}
	return s.Settings()
}

// nothingChanged says so on a failure before any write.
func nothingChanged(err error) error {
	return partly(err, nil)
}

// partly adds to a failure what was saved before it, so the bot never tells
// the person a request changed nothing when part of it landed.
func partly(err error, saved []string) error {
	var pe *problem.Error
	if !errors.As(err, &pe) {
		return err
	}
	if len(saved) == 0 {
		return pe.WithDetail("%s; nothing changed", pe.Detail)
	}
	return pe.WithDetail("%s; already saved before it failed: %s", pe.Detail, strings.Join(saved, ", "))
}

func onOff(on bool) string {
	if on {
		return "on"
	}
	return "off"
}
