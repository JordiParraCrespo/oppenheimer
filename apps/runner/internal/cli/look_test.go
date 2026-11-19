package cli

import (
	"bytes"
	"strings"
	"testing"
)

// A script that wraps the runner, the service's log and every other reader
// that is not a person at a terminal must get the lines exactly as they read
// without the mark: no escape codes, no banner. Breaking LookFor's terminal
// check would put escape codes into `runner status | grep`.
func TestLookIsPlainOffATerminal(t *testing.T) {
	t.Setenv("CLICOLOR_FORCE", "")
	t.Setenv("FORCE_COLOR", "")
	t.Setenv("NO_COLOR", "")
	var out bytes.Buffer
	look := LookFor(&out)
	look.Banner(&out, " v1", "subtitle")
	line := look.State("ok", "running") + " " + look.Accent("runner status") + " " + look.Label("fail", "error:")
	if out.Len() != 0 || line != "running runner status error:" {
		t.Fatalf("plain look decorated: banner %q, line %q", out.String(), line)
	}
}

// NO_COLOR wins over a forced colour, as https://no-color.org asks.
func TestNoColorWinsOverForce(t *testing.T) {
	t.Setenv("CLICOLOR_FORCE", "1")
	t.Setenv("NO_COLOR", "1")
	if LookFor(&bytes.Buffer{}).Decorated() {
		t.Fatal("NO_COLOR did not turn the look off")
	}
}

// Forced on, a state is a coloured dot and the same word, and 24-bit
// terminals get the design system's own hues.
func TestForcedLookDrawsTheConsoleVocabulary(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("CLICOLOR_FORCE", "1")
	t.Setenv("COLORTERM", "truecolor")
	look := LookFor(&bytes.Buffer{})
	state := look.State("ok", "running")
	if !strings.Contains(state, "●") || !strings.HasSuffix(state, " running") || !strings.Contains(state, "38;2;3;170;73") {
		t.Fatalf("state = %q", state)
	}
	var out bytes.Buffer
	look.Banner(&out, "", "subtitle")
	if !strings.Contains(out.String(), "Oppenheimer Runner") || !strings.Contains(out.String(), "▗▆▄▆▖") {
		t.Fatalf("banner = %q", out.String())
	}
}
