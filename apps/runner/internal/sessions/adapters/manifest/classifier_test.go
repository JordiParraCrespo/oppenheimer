package manifest_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func classify(t *testing.T, screen string) (domain.State, string) {
	t.Helper()
	return manifest.New().Classify(screen, domain.AgentClaude)
}

func TestAWorkingAgentReadsAsWorking(t *testing.T) {
	for name, screen := range map[string]string{
		"spinner and interrupt hint": "⠹ Thinking… (12s · esc to interrupt)",
		"a verb and an ellipsis":     "Searching… src/**/*.go",
		"elapsed time":               "  (45s · 1.2k tokens)",
	} {
		t.Run(name, func(t *testing.T) {
			if state, _ := classify(t, screen); state != domain.StateWorking {
				t.Fatalf("state = %q, want working", state)
			}
		})
	}
}

func TestAQuestionReadsAsBlocked(t *testing.T) {
	for name, screen := range map[string]string{
		"proceed":      "Do you want to proceed?\n  1. Yes\n  2. No",
		"y/n":          "Overwrite config.json? (y/n)",
		"approval":     "Permission required to run: rm -rf build",
		"press enter":  "Press enter to continue",
		"paste a code": "Paste the code here >",
	} {
		t.Run(name, func(t *testing.T) {
			if state, _ := classify(t, screen); state != domain.StateBlocked {
				t.Fatalf("state = %q, want blocked", state)
			}
		})
	}
}

func TestALoginURLBlocksAndIsOffered(t *testing.T) {
	screen := "Claude Code v2.x\nOpen this URL to authenticate:\n\n  https://claude.ai/oauth/authorize?code=true&client_id=abc\n"

	state, url := classify(t, screen)

	if state != domain.StateBlocked {
		t.Fatalf("state = %q, want blocked: nothing happens until a person logs in", state)
	}
	if url != "https://claude.ai/oauth/authorize?code=true&client_id=abc" {
		t.Fatalf("url = %q", url)
	}
}

func TestOnlyVendorLoginHostsAreOffered(t *testing.T) {
	// The agent's output is untrusted: a link in a README it just printed
	// must never become a button (F3).
	for _, screen := range []string{
		"Fix the bug described at https://evil.example/claude.ai/oauth",
		"See https://github.com/some/repo/blob/main/README.md",
		"curl https://claude.ai.attacker.test/oauth",
	} {
		if url := manifest.LoginURL(screen); url != "" {
			t.Fatalf("LoginURL(%q) = %q, want nothing", screen, url)
		}
	}

	// The real device-code flow is offered.
	if url := manifest.LoginURL("go to https://github.com/login/device and enter ABCD-1234"); url == "" {
		t.Fatal("a real vendor login URL must be offered")
	}
}

func TestAPromptWithNothingHappeningIsIdle(t *testing.T) {
	screen := "Claude Code v2.x\n\n>\n"

	if state, _ := classify(t, screen); state != domain.StateIdle {
		t.Fatalf("state = %q, want idle", state)
	}
}

func TestAnUnreadableScreenIsUnknownNotIdle(t *testing.T) {
	// Guessing idle for a long unattended run would be worse than admitting
	// we cannot tell: the sidebar would say "nothing is happening" while the
	// agent is mid-task.
	screen := "  1234 packets transmitted\n  some output nobody wrote a rule for\n"

	if state, _ := classify(t, screen); state != domain.StateUnknown {
		t.Fatalf("state = %q, want unknown", state)
	}
	if state, _ := classify(t, ""); state != domain.StateUnknown {
		t.Fatalf("empty screen = %q, want unknown", state)
	}
}

func TestOnlyTheTailIsRead(t *testing.T) {
	// An old question scrolled far up must not keep a session blocked.
	screen := "Do you want to proceed?\n" + repeat("build output\n", 40) + "⠹ Working… (3s · esc to interrupt)"

	if state, _ := classify(t, screen); state != domain.StateWorking {
		t.Fatalf("state = %q, want working: the question is long gone", state)
	}
}

func TestTrailingBlankLinesDoNotHideTheState(t *testing.T) {
	screen := "⠹ Thinking… (2s · esc to interrupt)\n\n\n\n\n\n\n\n"

	if state, _ := classify(t, screen); state != domain.StateWorking {
		t.Fatalf("state = %q, want working", state)
	}
}

func repeat(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}
