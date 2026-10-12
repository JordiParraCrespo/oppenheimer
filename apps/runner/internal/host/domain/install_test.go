package domain_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// OpenCode's `upgrade` stops to ask unless told how it was installed, so the
// runner tells it from where the binary lives, and leaves alone an install
// it cannot name rather than run an updater nobody can answer.
func TestOpenCodeUpdatesOnlyWithAKnownMethod(t *testing.T) {
	cases := []struct {
		resolved string
		want     []string
	}{
		{"/home/jordi/.opencode/bin/opencode", []string{"upgrade", "--method", "curl"}},
		{"/opt/homebrew/Cellar/opencode/1.18.33/bin/opencode", []string{"upgrade", "--method", "brew"}},
		{"/home/jordi/.local/lib/node_modules/opencode-ai/bin/opencode", []string{"upgrade", "--method", "npm"}},
		{"/home/jordi/.local/share/pnpm/global/5/node_modules/opencode-ai/bin/opencode", []string{"upgrade", "--method", "pnpm"}},
		{"/home/jordi/.bun/install/global/node_modules/opencode-ai/bin/opencode", []string{"upgrade", "--method", "bun"}},
		{"/usr/local/bin/opencode", nil},
		{"", nil},
	}
	for _, c := range cases {
		args, ok := domain.ResolveUpdateArgs(domain.ToolOpenCode, c.resolved)
		if ok != (c.want != nil) || !slices.Equal(args, c.want) {
			t.Errorf("%q: %v (ok %v), want %v", c.resolved, args, ok, c.want)
		}
	}
	// An updater with no method in it is the catalog's argv, whatever the path.
	if args, ok := domain.ResolveUpdateArgs(domain.ToolClaude, "/anywhere/claude"); !ok || !slices.Equal(args, []string{"update"}) {
		t.Errorf("claude: %v (ok %v)", args, ok)
	}
}

// The runner installs agents and gh itself, and never git or tmux: those
// need root, so the person gets the exact command instead.
func TestInstallScriptsByKindAndPlatform(t *testing.T) {
	for _, agent := range []string{domain.ToolClaude, domain.ToolCodex, domain.ToolOpenCode, domain.ToolGrok} {
		for _, platform := range []domain.Platform{domain.PlatformMacOS, domain.PlatformUbuntu, domain.PlatformDebian} {
			script, kind, err := domain.InstallScript(agent, platform)
			if err != nil || kind != domain.InstallAgent || script == "" {
				t.Errorf("%s on %s: kind %q err %v", agent, platform, kind, err)
			}
			if strings.Contains(script, "sudo") {
				t.Errorf("%s on %s installs with sudo", agent, platform)
			}
		}
	}
	if _, kind, err := domain.InstallScript(domain.ToolGH, domain.PlatformUbuntu); err != nil || kind != domain.InstallTool {
		t.Errorf("gh: kind %q err %v", kind, err)
	}
	for _, tool := range []string{domain.ToolGit, domain.ToolTmux} {
		if _, _, err := domain.InstallScript(tool, domain.PlatformUbuntu); !errors.Is(err, domain.ErrInstallByPackageManager) {
			t.Errorf("%s: %v, want ErrInstallByPackageManager", tool, err)
		}
	}
	if _, _, err := domain.InstallScript("rm", domain.PlatformUbuntu); !errors.Is(err, domain.ErrInstallUnknown) {
		t.Errorf("rm: %v, want ErrInstallUnknown", err)
	}
	if _, _, err := domain.InstallScript(domain.ToolClaude, domain.PlatformLinuxOther); !errors.Is(err, domain.ErrInstallPlatform) {
		t.Errorf("claude on other linux: %v, want ErrInstallPlatform", err)
	}
}

// Every tool the runner can install is one it probes, or the install would
// succeed and the host would still report it missing.
func TestEveryInstallableToolIsProbed(t *testing.T) {
	for _, kind := range []domain.InstallKind{domain.InstallAgent, domain.InstallTool} {
		for _, name := range domain.Installable(kind) {
			if !slices.Contains(domain.ProbedTools, name) {
				t.Errorf("%s is installable but not in ProbedTools", name)
			}
		}
	}
}

func TestPackageInstallCommand(t *testing.T) {
	tools := []string{domain.ToolGit, domain.ToolTmux}
	if got := domain.PackageInstallCommand(domain.PlatformMacOS, tools); got != "brew install git tmux" {
		t.Errorf("macOS: %q", got)
	}
	if got := domain.PackageInstallCommand(domain.PlatformDebian, tools); got != "sudo apt-get install -y git tmux" {
		t.Errorf("debian: %q", got)
	}
	if got := domain.PackageInstallCommand(domain.PlatformLinuxOther, tools); got != "" {
		t.Errorf("other linux: %q", got)
	}
}
