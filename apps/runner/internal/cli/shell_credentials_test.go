package cli

import (
	"os"
	"testing"
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

	env := shellCredentialHelper(paths)

	if env["GIT_CONFIG_COUNT"] != "1" || env["GIT_CONFIG_KEY_0"] != "credential.https://github.com.helper" {
		t.Fatalf("env = %v", env)
	}
	if want := paths.Current() + " credential-helper"; env["GIT_CONFIG_VALUE_0"] != want {
		t.Fatalf("helper = %q, want %q", env["GIT_CONFIG_VALUE_0"], want)
	}
}
