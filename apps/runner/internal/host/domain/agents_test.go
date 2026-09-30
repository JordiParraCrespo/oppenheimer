package domain_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// The catalog decides which CLIs the runner updates on its own. git and tmux
// are the package manager's, and OpenCode's updater stops to ask.
func TestOnlyUnattendedAgentUpdatersAreRun(t *testing.T) {
	cases := []struct {
		tool string
		ok   bool
	}{
		{domain.ToolClaude, true},
		{domain.ToolCodex, true},
		{domain.ToolGrok, true},
		{domain.ToolGit, false},
		{domain.ToolTmux, false},
		{domain.ToolOpenCode, false},
	}
	for _, c := range cases {
		args, ok := domain.AgentUpdateArgs(c.tool)
		if ok != c.ok || ok != (len(args) > 0) {
			t.Errorf("%s: updater %v (ok %v), want ok %v", c.tool, args, ok, c.ok)
		}
	}
}

func TestAgentUpdateArgsIsACopy(t *testing.T) {
	args, _ := domain.AgentUpdateArgs(domain.ToolClaude)
	args[0] = "rm"
	if again, _ := domain.AgentUpdateArgs(domain.ToolClaude); again[0] != "update" {
		t.Fatalf("the table was mutated through a returned slice: %v", again)
	}
}

func TestSameVersionComparesTheReleaseNotTheLine(t *testing.T) {
	cases := []struct {
		a, b string
		same bool
	}{
		{"grok 1.0.44 (5b807183dd79)", "grok 1.0.44 (5b807183dd79) [stable]", true},
		{"2.1.274 (Claude Code)", "2.1.284 (Claude Code)", false},
		{"codex-cli 0.155.1", "codex-cli 0.158.0", false},
		{"", "", true},
		{"unknown", "unknown", true},
	}
	for _, c := range cases {
		if got := domain.SameVersion(c.a, c.b); got != c.same {
			t.Errorf("SameVersion(%q, %q) = %v, want %v", c.a, c.b, got, c.same)
		}
	}
}
