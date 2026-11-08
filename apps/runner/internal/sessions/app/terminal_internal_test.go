package app

import (
	"regexp"
	"strings"
	"testing"
)

func matchesFresh(t *testing.T, before, after, echo, pattern string) bool {
	t.Helper()
	re := regexp.MustCompile(pattern)
	for _, line := range fresh(strings.Split(after, "\n"), strings.Split(before, "\n"), echo) {
		if re.MatchString(line) {
			return true
		}
	}
	return false
}

// What the screen holds after typing is judged by what the typing produced.
// The verifier's regression: waiting for the prompt after a command never
// matched, because the old prompt line was counted before typing and the new
// one only brought the count back level.
func TestTheLinesATypedCommandProducedAreWhatMatches(t *testing.T) {
	for _, tc := range []struct {
		name, before, after, echo, pattern string
		want                               bool
	}{
		{"the prompt comes back after a command", "root@vm:~# ", "root@vm:~# echo hi\nhi\nroot@vm:~# ", "echo hi", `[#$] $`, true},
		{"still running: only the command line", "root@vm:~# ", "root@vm:~# sleep 5", "sleep 5", `[#$] $`, false},
		{"the command line matches its own pattern", "$ ", "$ echo READY", "echo READY", `READY`, false},
		{"output that prints it matches", "$ ", "$ echo READY\nREADY\n$ ", "echo READY", `^READY$`, true},
		{"a stale prompt is not the answer", "password: ", "password: hunter-not", "hunter-not", `password:`, false},
		{"the command line scrolled away", "$ old\nMARK-S\n$ ", "77\n78\n79\n80\nMARK-S\n$ ", "seq 1 80; echo MARK-S", `MARK-S`, true},
		{"keys only: what changed counts", "$ sleep 9\n", "$ sleep 9\n^C\n$ ", "", `\$ $`, true},
		{"keys only: nothing changed", "$ ", "$ ", "", `\$ $`, false},
	} {
		if got := matchesFresh(t, tc.before, tc.after, tc.echo, tc.pattern); got != tc.want {
			t.Errorf("%s: matched = %v, want %v", tc.name, got, tc.want)
		}
	}
}
