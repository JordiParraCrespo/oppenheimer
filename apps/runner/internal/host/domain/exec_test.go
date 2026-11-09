package domain_test

import (
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// The allowlist decides on the program that will run. A regression that
// matched a bare name against a path's base would let `./python3`, a file
// the bot wrote, pass for the system's python3.
func TestTheAllowlistMatchesTheProgramThatRuns(t *testing.T) {
	policy := domain.ExecPolicy{Mode: domain.ExecAllowlist, Allow: []string{"python3", "/home/me/scripts/*"}}
	for _, tc := range []struct {
		program, dir string
		allowed      bool
	}{
		{"python3", "/home/me", true},
		{"./python3", "/home/me", false},
		{"/tmp/python3", "/home/me", false},
		{"/home/me/scripts/report.sh", "/tmp", true},
		{"scripts/report.sh", "/home/me", true},
		{"../scripts/report.sh", "/home/me/x", true},
		{"/home/me/scripts/sub/deep.sh", "/tmp", false},
		{"report.sh", "/home/me/scripts", false},
		{"bash", "/home/me", false},
	} {
		err := policy.Permits(tc.program, tc.dir)
		if tc.allowed && err != nil {
			t.Errorf("%s in %s refused: %v", tc.program, tc.dir, err)
		}
		if !tc.allowed && !errors.Is(err, domain.ErrExecNotAllowed) {
			t.Errorf("%s in %s: got %v, want not allowed", tc.program, tc.dir, err)
		}
	}
}

// A mode the runner does not know is off, so a hand-edited typo refuses
// rather than runs everything.
func TestAnUnknownModeIsOff(t *testing.T) {
	for _, mode := range []domain.ExecMode{"", "ful", "FULL"} {
		err := domain.ExecPolicy{Mode: mode, Allow: []string{"echo"}}.Permits("echo", "/")
		if !errors.Is(err, domain.ErrExecOff) {
			t.Errorf("mode %q: got %v, want off", mode, err)
		}
	}
	if err := (domain.ExecPolicy{Mode: domain.ExecFull}).Permits("anything", "/"); err != nil {
		t.Fatalf("full refused: %v", err)
	}
}

func TestAnAllowlistEntryIsANameOrAnAbsolutePath(t *testing.T) {
	for _, entry := range []string{"python3", "/usr/bin/node", "/home/me/scripts/*"} {
		if err := domain.ValidExecEntry(entry); err != nil {
			t.Errorf("%q refused: %v", entry, err)
		}
	}
	for _, entry := range []string{"", "scripts/x", "python3 -c", "/a/[b"} {
		if err := domain.ValidExecEntry(entry); err == nil {
			t.Errorf("%q accepted", entry)
		}
	}
}
