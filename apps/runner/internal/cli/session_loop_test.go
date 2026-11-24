package cli

import (
	"testing"
	"time"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The person is told an agent waits on them at its block's second report, so
// the loop looks again within seconds of seeing one, not a whole interval on;
// a block already confirmed, or none, keeps the slow interval.
func TestTheLoopLooksAgainSoonAfterAnAgentBlocks(t *testing.T) {
	now := time.Date(2026, 11, 23, 9, 0, 0, 0, time.UTC)
	session := func(state sessionsdomain.State, since time.Duration) sessionsdomain.Session {
		return sessionsdomain.Session{State: state, Updated: now.Add(-since)}
	}
	for _, tc := range []struct {
		name     string
		sessions []sessionsdomain.Session
		want     time.Duration
	}{
		{"just blocked", []sessionsdomain.Session{session(sessionsdomain.StateWorking, time.Second), session(sessionsdomain.StateBlocked, time.Second)}, sessionsapp.BlockedConfirmAfter},
		{"blocked long ago", []sessionsdomain.Session{session(sessionsdomain.StateBlocked, time.Minute)}, sessionLoopInterval},
		{"nobody blocked", []sessionsdomain.Session{session(sessionsdomain.StateWorking, time.Second)}, sessionLoopInterval},
		{"no sessions", nil, sessionLoopInterval},
	} {
		if got := nextSessionLook(tc.sessions, now); got != tc.want {
			t.Errorf("%s: next look in %s, want %s", tc.name, got, tc.want)
		}
	}
}
