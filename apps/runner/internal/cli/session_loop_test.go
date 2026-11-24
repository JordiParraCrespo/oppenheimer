package cli

import (
	"testing"
	"time"
)

// The person is told an agent waits on them at its block's second report, so
// the loop looks again when that report is due, not a whole interval on; with
// none due it keeps the slow interval, and it never spins faster than a second.
func TestTheLoopLooksAgainWhenABlockIsDueToBeConfirmed(t *testing.T) {
	for _, tc := range []struct {
		name    string
		due     time.Duration
		pending bool
		want    time.Duration
	}{
		{"a block due in 2 s", 2 * time.Second, true, 2 * time.Second},
		{"a block already due", 0, true, time.Second},
		{"a block due after the interval", time.Minute, true, sessionLoopInterval},
		{"nothing to confirm", 0, false, sessionLoopInterval},
	} {
		if got := nextSessionLook(tc.due, tc.pending); got != tc.want {
			t.Errorf("%s: next look in %s, want %s", tc.name, got, tc.want)
		}
	}
}
