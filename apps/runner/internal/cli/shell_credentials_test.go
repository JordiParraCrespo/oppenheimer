package cli

import (
	"os"
	"testing"

	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The git in a session's shell asks the runner for GitHub credentials through
// the service's `current` link, which an update moves but never removes.
func TestTheShellsCredentialHelperIsTheCurrentLink(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	if err := os.MkdirAll(paths.Bin(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.Current(), nil, 0o700); err != nil {
		t.Fatal(err)
	}

	env := shellCredentialHelper(paths, false)

	if env["GIT_CONFIG_COUNT"] != "1" || env["GIT_CONFIG_KEY_0"] != "credential.https://github.com.helper" {
		t.Fatalf("env = %v", env)
	}
	if want := paths.Current() + " credential-helper"; env["GIT_CONFIG_VALUE_0"] != want {
		t.Fatalf("helper = %q, want %q", env["GIT_CONFIG_VALUE_0"], want)
	}
}

// The helper tells a session's repositories apart by the path git sends, so
// a session over several has git send it. A session of one is left as it
// was: the setting would reach the person's own GitHub helpers too.
func TestASessionOverSeveralRepositoriesHasGitSendThePath(t *testing.T) {
	paths := Paths{Home: t.TempDir()}
	one := sessionsdomain.Session{ID: "s", Place: sessionsdomain.PlaceWorktree, Repo: "acme/web", Worktree: "/w/s/web"}
	two := one
	two.More = []sessionsdomain.Checkout{{Repo: "acme/api", Worktree: "/w/s/api"}}

	if env := sessionEnv(paths, one); env["GIT_CONFIG_KEY_1"] != "" || env["OPPENHEIMER_REPO"] != "acme/web" {
		t.Fatalf("one checkout: env = %v", env)
	}
	env := sessionEnv(paths, two)
	if env["GIT_CONFIG_COUNT"] != "2" || env["GIT_CONFIG_KEY_1"] != "credential.https://github.com.useHttpPath" ||
		env["GIT_CONFIG_VALUE_1"] != "true" || env["OPPENHEIMER_REPO"] != "acme/web" {
		t.Fatalf("two checkouts: env = %v", env)
	}
}
