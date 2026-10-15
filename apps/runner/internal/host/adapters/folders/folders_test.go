package folders_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/folders"
)

// A HEAD is read, never run: a branch is what follows refs/heads/, a detached
// checkout its short commit id, and anything else (another ref, garbage) no
// branch at all.
func TestBranchOfReadsWhatGitWroteInHEAD(t *testing.T) {
	for head, want := range map[string]string{
		"ref: refs/heads/main\n":                     "main",
		"ref: refs/heads/feature/login":              "feature/login",
		"ref:refs/heads/x":                           "x",
		"0123456789abcdef0123456789abcdef01234567\n": "0123456",
		"ref: refs/remotes/origin/main":              "",
		"ref: refs/heads/":                           "",
		"not a head":                                 "",
		"0123456789ABCDEF0123456789ABCDEF01234567":   "",
	} {
		if got := folders.BranchOf(head); got != want {
			t.Errorf("BranchOf(%q) = %q, want %q", head, got, want)
		}
	}
}
