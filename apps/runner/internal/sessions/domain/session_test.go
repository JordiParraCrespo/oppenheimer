package domain_test

import (
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func TestSlugNamesTheWorktreeAfterTheBranch(t *testing.T) {
	id := "nkuxganccspr"

	for name, tc := range map[string]struct{ branch, want string }{
		"a session branch says the id once": {domain.DefaultBranchName(id), "oppenheimer-" + id},
		"a feature branch keeps the id":     {"feat/login", "feat-login-" + id},
		"slashes and dots are flattened":    {"release/1.2.x", "release-1-2-x-" + id},
		"an empty branch falls back":        {"", id},
	} {
		t.Run(name, func(t *testing.T) {
			if got := domain.Slug(tc.branch, id); got != tc.want {
				t.Fatalf("Slug(%q) = %q, want %q", tc.branch, got, tc.want)
			}
		})
	}
}

func TestSlugStaysAUsableDirectoryName(t *testing.T) {
	slug := domain.Slug(strings.Repeat("very-long-branch-name/", 10), "abcdefghijkl")

	if len(slug) > 64 {
		t.Fatalf("slug is %d characters: %q", len(slug), slug)
	}
	if strings.ContainsAny(slug, "/\\ .") {
		t.Fatalf("slug %q must be a plain directory name", slug)
	}
}

func TestValidateRefusesWhatWouldEscapeOrConfuseGit(t *testing.T) {
	for _, repo := range []string{"../etc", "owner/../../etc", "owner", "", "own er/repo"} {
		if err := domain.ValidateRepo(repo); err == nil {
			t.Fatalf("ValidateRepo(%q) must fail", repo)
		}
	}
	if err := domain.ValidateRepo("jordi/oppenheimer"); err != nil {
		t.Fatalf("a normal repository must be accepted: %v", err)
	}

	for _, branch := range []string{"../../etc/passwd", "-x", "feat/", "feat..x", "x.lock", ""} {
		if err := domain.ValidateBranch(branch); err == nil {
			t.Fatalf("ValidateBranch(%q) must fail", branch)
		}
	}
	for _, branch := range []string{"main", "feat/login", "oppenheimer/abc123", "release-1.2"} {
		if err := domain.ValidateBranch(branch); err != nil {
			t.Fatalf("ValidateBranch(%q): %v", branch, err)
		}
	}
}

func TestIDsAreUnguessableAndTmuxSafe(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 500; i++ {
		id, err := domain.NewID()
		if err != nil {
			t.Fatal(err)
		}
		if len(id) != 12 || strings.ContainsAny(id, ":.$ /") {
			t.Fatalf("id %q is not usable as a tmux session name", id)
		}
		if seen[id] {
			t.Fatalf("duplicate id %q", id)
		}
		seen[id] = true
	}
}

func TestNextWindowNeverReusesAClosedTabsNumber(t *testing.T) {
	session := domain.Session{Windows: []domain.Window{{Index: 0}, {Index: 3}}}

	if got := session.NextWindow(); got != 4 {
		t.Fatalf("NextWindow = %d, want 4: a reused number would confuse an attached client", got)
	}
}

func TestOnlyLiveStatesExpectATmuxSession(t *testing.T) {
	for _, state := range []domain.State{domain.StateStarting, domain.StateWorking, domain.StateBlocked, domain.StateIdle, domain.StateDone, domain.StateUnknown} {
		if !state.Live() {
			t.Fatalf("%q must be live", state)
		}
	}
	for _, state := range []domain.State{domain.StateStopped, domain.StateClosed} {
		if state.Live() {
			t.Fatalf("%q must not be live", state)
		}
	}
}
