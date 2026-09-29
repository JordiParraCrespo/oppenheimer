package domain_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

func TestEveryAgentToolHasAnUpdaterAndHostToolsDoNot(t *testing.T) {
	for _, tool := range []string{domain.ToolClaude, domain.ToolCodex, domain.ToolOpenCode, domain.ToolGrok} {
		if args, ok := domain.AgentUpdateArgs(tool); !ok || len(args) == 0 {
			t.Errorf("%s: no updater", tool)
		}
	}
	for _, tool := range []string{domain.ToolGit, domain.ToolTmux} {
		if _, ok := domain.AgentUpdateArgs(tool); ok {
			t.Errorf("%s is the package manager's to update, not ours", tool)
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

func TestUpdateFailureDetailSkipsTheTUIsLeftovers(t *testing.T) {
	// opencode 1.18.33's upgrade, installed through npm, with stdin closed.
	output := "\x1b[0m\n\u250c  Upgrade\n\u2502\n\u2717  opencode is installed to /x/opencode.exe and may be managed by a package manager\n" +
		"\x1b[?25l\u2502\n\u25c6  Install anyways?\n\u2502    Yes\n\u2502  > No\n\u2014"
	if got := domain.UpdateFailureDetail(output); got != "Install anyways?" {
		t.Fatalf("detail = %q", got)
	}
	if got := domain.UpdateFailureDetail("npm error code EACCES\nnpm error EACCES: permission denied\n"); got != "npm error EACCES: permission denied" {
		t.Fatalf("detail = %q", got)
	}
}
