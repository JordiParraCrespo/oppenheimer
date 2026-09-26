// Package domain describes the service unit that keeps the runner alive on a
// host: what it executes, where it logs, and — the part that is not a detail —
// how the init system must stop it.
//
// The runner starts a tmux server that outlives it, and sessions live in that
// server. Both init systems kill a job's whole process tree by default, which
// would make every restart, upgrade and rollback destroy the sessions it was
// supposed to preserve. Rendering a unit that stops only the main process is
// therefore a domain rule here, not a tuning knob: `KillMode=process` on
// systemd, `AbandonProcessGroup` on launchd.
package domain

import (
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

// Kind is the init system a host registers the runner with.
type Kind string

// Kinds.
const (
	KindLaunchd Kind = "launchd"
	KindSystemd Kind = "systemd"
)

// Label is the reverse-DNS launchd job name, and the systemd unit is named
// after the same product so a user grepping for either finds both.
const (
	Label       = "dev.oppenheimer.runner"
	SystemdUnit = "oppenheimer-runner.service"
)

// Sentinel conditions.
var (
	ErrUnsupportedKind = errors.New("no service manager for this platform")
	ErrExecPath        = errors.New("the unit needs an absolute path to the runner")
)

// Unit is everything both init systems need.
type Unit struct {
	// ExecPath is the `current` symlink, never a versioned binary: that is
	// what makes an update a symlink swap plus a restart.
	ExecPath string
	Args     []string
	// WorkingDir is the user's home; the runner resolves its own paths.
	WorkingDir string
	LogDir     string
	Env        map[string]string
	// User is whose account the unit runs as, for the human-readable
	// description only. The runner never runs as anyone else.
	User string
}

// Validate refuses a unit that would not start.
func (u Unit) Validate() error {
	if u.ExecPath == "" || !filepath.IsAbs(u.ExecPath) {
		return fmt.Errorf("%w: %q", ErrExecPath, u.ExecPath)
	}
	return nil
}

// StdoutPath and StderrPath are where the daemon's output lands.
func (u Unit) StdoutPath() string { return filepath.Join(u.LogDir, "runner.log") }

// StderrPath is the error stream's file.
func (u Unit) StderrPath() string { return filepath.Join(u.LogDir, "runner.err.log") }

// FileName is the unit file's name for a kind.
func FileName(kind Kind) (string, error) {
	switch kind {
	case KindLaunchd:
		return Label + ".plist", nil
	case KindSystemd:
		return SystemdUnit, nil
	}
	return "", fmt.Errorf("%w: %q", ErrUnsupportedKind, kind)
}

// Render produces the unit file's content.
func (u Unit) Render(kind Kind) (string, error) {
	if err := u.Validate(); err != nil {
		return "", err
	}
	switch kind {
	case KindLaunchd:
		return u.renderLaunchd(), nil
	case KindSystemd:
		return u.renderSystemd(), nil
	}
	return "", fmt.Errorf("%w: %q", ErrUnsupportedKind, kind)
}

func (u Unit) renderSystemd() string {
	var b strings.Builder
	b.WriteString("[Unit]\n")
	b.WriteString("Description=Oppenheimer runner (" + u.User + ")\n")
	b.WriteString("Documentation=https://oppenheimer.dev/docs/runner\n")
	b.WriteString("After=network-online.target\n")
	b.WriteString("Wants=network-online.target\n\n")

	b.WriteString("[Service]\n")
	b.WriteString("Type=simple\n")
	b.WriteString("ExecStart=" + quoteArgs(u.ExecPath, u.Args) + "\n")
	if u.WorkingDir != "" {
		b.WriteString("WorkingDirectory=" + u.WorkingDir + "\n")
	}
	for _, kv := range sortedEnv(u.Env) {
		b.WriteString("Environment=" + kv + "\n")
	}
	b.WriteString("Restart=always\n")
	b.WriteString("RestartSec=5\n")
	// Only the runner is stopped. The tmux server it started keeps every
	// session alive across a restart, an upgrade and a rollback.
	b.WriteString("KillMode=process\n")
	b.WriteString("TimeoutStopSec=30\n")
	if u.LogDir != "" {
		b.WriteString("StandardOutput=append:" + u.StdoutPath() + "\n")
		b.WriteString("StandardError=append:" + u.StderrPath() + "\n")
	}
	b.WriteString("\n[Install]\n")
	b.WriteString("WantedBy=default.target\n")
	return b.String()
}

func (u Unit) renderLaunchd() string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	b.WriteString(`<plist version="1.0">` + "\n<dict>\n")
	b.WriteString("  <key>Label</key>\n  <string>" + escapeXML(Label) + "</string>\n")

	b.WriteString("  <key>ProgramArguments</key>\n  <array>\n")
	for _, arg := range append([]string{u.ExecPath}, u.Args...) {
		b.WriteString("    <string>" + escapeXML(arg) + "</string>\n")
	}
	b.WriteString("  </array>\n")

	b.WriteString("  <key>RunAtLoad</key>\n  <true/>\n")
	b.WriteString("  <key>KeepAlive</key>\n  <true/>\n")
	b.WriteString("  <key>ProcessType</key>\n  <string>Background</string>\n")
	// launchd kills the job's whole process group unless it is told to let
	// it go. The tmux server is in that group, so this flag is the macOS
	// half of "a runner restart loses nothing".
	b.WriteString("  <key>AbandonProcessGroup</key>\n  <true/>\n")
	if u.WorkingDir != "" {
		b.WriteString("  <key>WorkingDirectory</key>\n  <string>" + escapeXML(u.WorkingDir) + "</string>\n")
	}
	if u.LogDir != "" {
		b.WriteString("  <key>StandardOutPath</key>\n  <string>" + escapeXML(u.StdoutPath()) + "</string>\n")
		b.WriteString("  <key>StandardErrorPath</key>\n  <string>" + escapeXML(u.StderrPath()) + "</string>\n")
	}
	if len(u.Env) > 0 {
		b.WriteString("  <key>EnvironmentVariables</key>\n  <dict>\n")
		for _, key := range sortedKeys(u.Env) {
			b.WriteString("    <key>" + escapeXML(key) + "</key>\n")
			b.WriteString("    <string>" + escapeXML(u.Env[key]) + "</string>\n")
		}
		b.WriteString("  </dict>\n")
	}
	b.WriteString("</dict>\n</plist>\n")
	return b.String()
}

func quoteArgs(exec string, args []string) string {
	parts := append([]string{exec}, args...)
	for i, p := range parts {
		if strings.ContainsAny(p, " \t") {
			parts[i] = `"` + p + `"`
		}
	}
	return strings.Join(parts, " ")
}

func sortedEnv(env map[string]string) []string {
	out := make([]string, 0, len(env))
	for _, k := range sortedKeys(env) {
		out = append(out, `"`+k+"="+env[k]+`"`)
	}
	return out
}

func sortedKeys(env map[string]string) []string {
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

var xmlEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")

func escapeXML(s string) string { return xmlEscaper.Replace(s) }

// Status is what the init system says about the unit.
type Status struct {
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	Kind      Kind   `json:"kind"`
	Path      string `json:"path,omitempty"`
	Detail    string `json:"detail,omitempty"`
}
