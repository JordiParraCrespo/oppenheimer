package system_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
)

// The updater's env is added to the runner's environment, not put in its
// place: an npm updater needs the prefix it is given and still the PATH and
// HOME the runner has.
func TestUpdaterAddsEnvToTheRunnersEnvironment(t *testing.T) {
	t.Setenv("HOME", "/home/jordi")
	updater := filepath.Join(t.TempDir(), "agent")
	script := "#!/bin/sh\n" +
		`[ "$npm_config_prefix" = /home/jordi/.local ] && [ "$HOME" = /home/jordi ] || { echo "prefix=$npm_config_prefix home=$HOME" >&2; exit 1; }` + "\n"
	if err := os.WriteFile(updater, []byte(script), 0o700); err != nil {
		t.Fatal(err)
	}
	err := system.Updater{}.Update(context.Background(), "agent", updater, nil, []string{"npm_config_prefix=/home/jordi/.local"})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
}
