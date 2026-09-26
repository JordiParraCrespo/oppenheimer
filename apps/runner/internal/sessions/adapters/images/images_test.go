package images_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/images"
)

func TestSaveWritesAPrivateFileAndDiscardDropsTheSession(t *testing.T) {
	dir := t.TempDir()
	store := images.New(dir)

	path, err := store.Save("s1", "a.png", []byte("png"))
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, "s1", "a.png"); path != want {
		t.Fatalf("path = %q, want %q", path, want)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, want 0600", info.Mode().Perm())
	}

	if err := store.Discard("s1"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "s1")); !os.IsNotExist(err) {
		t.Fatalf("the session's directory survived: %v", err)
	}
}

func TestSaveRefusesANameThatClimbs(t *testing.T) {
	store := images.New(t.TempDir())
	for _, name := range []string{"../a.png", "a/b.png", "..", ""} {
		if _, err := store.Save("s1", name, []byte("x")); err == nil {
			t.Fatalf("Save(%q) was accepted", name)
		}
	}
	if _, err := store.Save("../s1", "a.png", []byte("x")); err == nil {
		t.Fatal("a session id that climbs was accepted")
	}
}
