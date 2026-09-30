package tmux

import "testing"

func TestParsePanesKeepsATitleWhole(t *testing.T) {
	out := "opp-a\t0\t0\t1\t✳ Claude Code\twith a tab\n" +
		"opp-a\t1\t0\t0\t\n" +
		"garbage line\n" +
		"opp-b\tx\t0\t1\ttitle\n"

	panes := parsePanes(out)

	if len(panes) != 2 {
		t.Fatalf("panes = %+v, want the two readable lines: the garbage line and opp-b's non-integer window dropped", panes)
	}
	if got := panes[0]; got.Session != "opp-a" || got.Window != 0 || !got.Active || got.Title != "✳ Claude Code\twith a tab" {
		t.Fatalf("first = %+v", got)
	}
	if got := panes[1]; got.Session != "opp-a" || got.Window != 1 || got.Active || got.Title != "" {
		t.Fatalf("second = %+v, want opp-a's window 1 with its empty title kept", got)
	}
}
