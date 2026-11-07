package execpolicy_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/execpolicy"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// No file is off: a host that never ran `runner exec` runs nothing.
func TestNoPolicyFileIsOff(t *testing.T) {
	policy, err := execpolicy.File{Path: filepath.Join(t.TempDir(), "exec.json")}.Load()
	if err != nil || policy.Mode != domain.ExecOff {
		t.Fatalf("policy = %+v, err = %v", policy, err)
	}
}

// What is saved is read back, and the file is this account's alone.
func TestASavedPolicyIsPrivateAndReadBack(t *testing.T) {
	f := execpolicy.File{Path: filepath.Join(t.TempDir(), "exec.json")}
	want := domain.ExecPolicy{Mode: domain.ExecAllowlist, Allow: []string{"python3"}}
	if err := f.Save(want); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(f.Path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, err = %v", info.Mode().Perm(), err)
	}
	got, err := f.Load()
	if err != nil || got.Mode != want.Mode || len(got.Allow) != 1 || got.Allow[0] != "python3" {
		t.Fatalf("got %+v, err = %v", got, err)
	}
}

// A file another account can write is refused: whoever can write it decides
// what runs as this account.
func TestAPolicyOthersCanWriteIsRefused(t *testing.T) {
	f := execpolicy.File{Path: filepath.Join(t.TempDir(), "exec.json")}
	if err := os.WriteFile(f.Path, []byte(`{"mode":"full"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(f.Path, 0o666); err != nil {
		t.Fatal(err)
	}
	if _, err := f.Load(); err == nil {
		t.Fatal("a world-writable policy was used")
	}
}
