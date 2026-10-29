package system_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
)

// The console names the claude.ai account each host's `claude` is signed in
// as, so a person with two accounts can tell which host starts which. A file
// with no sign-in, or none at all, is "not signed in", never a failure.
func TestClaudeAccountReadsTheSignedInEmail(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".claude.json")
	cases := map[string]string{
		`{"oauthAccount":{"emailAddress":"ana@example.com","accountUuid":"x"},"projects":{}}`: "ana@example.com",
		`{"projects":{}}`:       "",
		`{"oauthAccount":null}`: "",
		`not json`:              "",
	}
	for raw, want := range cases {
		if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
			t.Fatal(err)
		}
		if got := system.ClaudeAccount(path); got != want {
			t.Errorf("ClaudeAccount(%s) = %q, want %q", raw, got, want)
		}
	}
	if got := system.ClaudeAccount(filepath.Join(dir, "missing.json")); got != "" {
		t.Errorf("a missing file = %q, want none", got)
	}
}
