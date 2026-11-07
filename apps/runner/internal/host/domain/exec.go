package domain

import (
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// ExecMode is how much a host lets bots run on it (`host.exec`, 25 §4.2). It
// is the host's own setting, kept in a file the control plane never reads or
// writes, so a compromised control plane can still run nothing the person
// did not allow here.
type ExecMode string

const (
	// ExecOff refuses every command. It is the default: a host runs nothing
	// for a bot until its owner says so on the host itself.
	ExecOff ExecMode = "off"
	// ExecAllowlist runs only the programs ExecPolicy.Allow names.
	ExecAllowlist ExecMode = "allowlist"
	// ExecFull runs any program.
	ExecFull ExecMode = "full"
)

// ExecModes is every mode, in the order `runner exec` lists them.
var ExecModes = []ExecMode{ExecOff, ExecAllowlist, ExecFull}

// ExecPolicy is what the host lets bots run.
type ExecPolicy struct {
	Mode ExecMode `json:"mode"`
	// Allow is the programs ExecAllowlist runs. An entry without a slash is a
	// program found on PATH (`python3`), matched against an argv[0] without
	// a slash; an entry with one is an absolute path or a glob over paths
	// (`/home/me/scripts/*`), matched against an argv[0] that has a slash,
	// made absolute against the folder the command runs in. A bare name never
	// matches a path, so `./python3` does not pass for `python3`.
	Allow []string `json:"allow,omitempty"`
}

// The reasons a policy refuses or cannot be kept.
var (
	ErrExecOff          = errors.New("running commands for bots is off on this host")
	ErrExecNotAllowed   = errors.New("the program is not on this host's allowlist")
	ErrExecModeUnknown  = errors.New("unknown exec mode")
	ErrExecEntryInvalid = errors.New("not a program name or an absolute path")
)

// ParseExecMode reads a mode as `runner exec mode` takes it.
func ParseExecMode(value string) (ExecMode, error) {
	mode := ExecMode(strings.ToLower(strings.TrimSpace(value)))
	if !slices.Contains(ExecModes, mode) {
		return "", fmt.Errorf("%w %q: one of off, allowlist, full", ErrExecModeUnknown, value)
	}
	return mode, nil
}

// Normalized is the policy as it is enforced: an unknown or empty mode is
// off, so a hand-edited file with a typo refuses rather than runs.
func (p ExecPolicy) Normalized() ExecPolicy {
	if !slices.Contains(ExecModes, p.Mode) {
		p.Mode = ExecOff
	}
	return p
}

// Permits reports whether the policy lets program run when it starts in dir.
// program is argv[0] as the bot sent it; dir is absolute.
func (p ExecPolicy) Permits(program, dir string) error {
	switch p.Normalized().Mode {
	case ExecFull:
		return nil
	case ExecAllowlist:
	default:
		return ErrExecOff
	}
	path := ""
	if strings.Contains(program, "/") {
		path = program
		if !filepath.IsAbs(path) {
			path = filepath.Join(dir, path)
		}
		path = filepath.Clean(path)
	}
	for _, entry := range p.Allow {
		if path == "" {
			if !strings.Contains(entry, "/") && entry == program {
				return nil
			}
			continue
		}
		if strings.Contains(entry, "/") {
			if ok, err := filepath.Match(entry, path); err == nil && ok {
				return nil
			}
		}
	}
	return ErrExecNotAllowed
}

// ValidExecEntry checks an allowlist entry as `runner exec allow` takes it: a
// bare program name, or an absolute path or glob.
func ValidExecEntry(entry string) error {
	if entry == "" || strings.ContainsAny(entry, " \t\n\x00") {
		return fmt.Errorf("%q: %w", entry, ErrExecEntryInvalid)
	}
	if strings.Contains(entry, "/") {
		if !filepath.IsAbs(entry) {
			return fmt.Errorf("%q: %w", entry, ErrExecEntryInvalid)
		}
		if _, err := filepath.Match(entry, "/"); err != nil {
			return fmt.Errorf("%q: %w", entry, ErrExecEntryInvalid)
		}
	}
	return nil
}

// ExecRequest is one program to run for a bot.
type ExecRequest struct {
	Argv []string
	// Dir is where it starts; empty is the bot's own folder.
	Dir string
	// Home names the bot's own folder under the workspaces' `bots/`.
	Home    string
	Timeout time.Duration
	// Limit is how many bytes of each stream are kept, the last ones.
	Limit int
}

// ExecResult is how the run ended.
type ExecResult struct {
	// ExitCode is nil when the program did not exit on its own (timed out,
	// or ended by a signal).
	ExitCode        *int
	TimedOut        bool
	Stdout          string
	Stderr          string
	StdoutTruncated bool
	StderrTruncated bool
	Dir             string
	Duration        time.Duration
}

// BotsDir is the folder under the workspaces that holds each bot's own.
const BotsDir = "bots"
