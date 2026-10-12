package system_test

import (
	"context"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
)

// A failed install says why in the installer's own last line, which is
// where a vendor script prints it.
func TestInstallerReportsTheScriptsLastLine(t *testing.T) {
	err := system.Installer{}.Install(context.Background(), "x", "echo working; echo 'npm is not on PATH' >&2; exit 3")
	if err == nil || err.Error() != "npm is not on PATH" {
		t.Fatalf("err = %v", err)
	}
	if err := (system.Installer{}).Install(context.Background(), "x", "read answer; true"); err != nil {
		t.Fatalf("a script reading stdin gets end-of-file, not a hang: %v", err)
	}
}
