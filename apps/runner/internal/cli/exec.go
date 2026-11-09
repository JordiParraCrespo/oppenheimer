package cli

import (
	"fmt"
	"io"
	"path/filepath"
	"slices"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ExecShow prints what this host lets bots run (`runner exec`).
func (a *App) ExecShow(out io.Writer) error {
	policy, err := a.Host.ExecPolicy()
	if err != nil {
		return err
	}
	p := newPrinter(out)
	p.printf("mode:   %s\n", policy.Mode)
	switch policy.Mode {
	case hostdomain.ExecOff:
		p.printf("        bots run nothing on this host\n")
	case hostdomain.ExecFull:
		p.printf("        bots run any program, as this account\n")
	case hostdomain.ExecAllowlist:
		if len(policy.Allow) == 0 {
			p.printf("allow:  (nothing yet: runner exec allow <program>)\n")
		}
		for i, entry := range policy.Allow {
			label := "allow: "
			if i > 0 {
				label = "       "
			}
			p.printf("%s %s\n", label, entry)
		}
	}
	p.printf("folder: %s\n", filepath.Join(a.Paths.Workspaces, hostdomain.BotsDir, "<bot>"))
	p.printf("file:   %s\n", a.Paths.ExecPolicy())
	return p.err
}

// ExecMode sets the mode (`runner exec mode off|allowlist|full`).
func (a *App) ExecMode(out io.Writer, value string) error {
	mode, err := hostdomain.ParseExecMode(value)
	if err != nil {
		return err
	}
	policy, err := a.Host.ExecPolicy()
	if err != nil {
		return err
	}
	policy.Mode = mode
	if err := a.Host.SetExecPolicy(policy); err != nil {
		return err
	}
	return a.ExecShow(out)
}

// ExecAllow adds programs to the allowlist (`runner exec allow <program>...`).
// It does not change the mode: a host still off stays off until `mode`.
func (a *App) ExecAllow(out io.Writer, entries []string) error {
	for _, entry := range entries {
		if err := hostdomain.ValidExecEntry(entry); err != nil {
			return err
		}
	}
	return a.editAllowlist(out, func(allow []string) []string {
		for _, entry := range entries {
			if !slices.Contains(allow, entry) {
				allow = append(allow, entry)
			}
		}
		return allow
	})
}

// ExecDeny removes programs from the allowlist (`runner exec deny <program>...`).
func (a *App) ExecDeny(out io.Writer, entries []string) error {
	return a.editAllowlist(out, func(allow []string) []string {
		return slices.DeleteFunc(allow, func(entry string) bool { return slices.Contains(entries, entry) })
	})
}

func (a *App) editAllowlist(out io.Writer, edit func([]string) []string) error {
	policy, err := a.Host.ExecPolicy()
	if err != nil {
		return err
	}
	policy.Allow = edit(slices.Clone(policy.Allow))
	if err := a.Host.SetExecPolicy(policy); err != nil {
		return err
	}
	if policy.Mode == hostdomain.ExecOff {
		if _, err := fmt.Fprintln(out, "note: the mode is off; `runner exec mode allowlist` turns the list on"); err != nil {
			return err
		}
	}
	return a.ExecShow(out)
}
