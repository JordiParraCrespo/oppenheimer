package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExcludeFromIndexingWritesTheMarkerOnMacOS(t *testing.T) {
	dir := t.TempDir()

	if err := excludeFromIndexing("darwin", dir); err != nil {
		t.Fatalf("exclude: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, IndexingOptOut)); err != nil {
		t.Fatalf("no %s in %s: %v", IndexingOptOut, dir, err)
	}
}

func TestExcludeFromIndexingIsIdempotentAndKeepsWhatIsThere(t *testing.T) {
	dir := t.TempDir()
	marker := filepath.Join(dir, IndexingOptOut)
	// Some people leave themselves a note in it; a second boot must not
	// truncate one.
	if err := os.WriteFile(marker, []byte("left by hand\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := excludeFromIndexing("darwin", dir); err != nil {
		t.Fatalf("exclude: %v", err)
	}

	content, err := os.ReadFile(marker)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "left by hand\n" {
		t.Fatalf("the marker was rewritten: %q", content)
	}
}

func TestExcludeFromIndexingDoesNothingElsewhere(t *testing.T) {
	dir := t.TempDir()

	if err := excludeFromIndexing("linux", dir); err != nil {
		t.Fatalf("exclude: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, IndexingOptOut)); !os.IsNotExist(err) {
		t.Fatalf("wrote a macOS marker on linux: %v", err)
	}
}

func TestExcludeFromIndexingCreatesAMissingRootPrivately(t *testing.T) {
	// The default root does not exist until something makes it; the boot that
	// asks for the opt-out is that something, or the first session's
	// worktrees are indexed before any marker can land.
	dir := filepath.Join(t.TempDir(), "oppenheimer-ai", "workspaces")

	if err := excludeFromIndexing("darwin", dir); err != nil {
		t.Fatalf("exclude: %v", err)
	}

	info, err := os.Stat(dir)
	if err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("root = %v, %v; want a 0700 directory", info, err)
	}
	if _, err := os.Stat(filepath.Join(dir, IndexingOptOut)); err != nil {
		t.Fatalf("no %s in the new root: %v", IndexingOptOut, err)
	}
}

func TestExcludeFromIndexingSaysWhenItCannotWrite(t *testing.T) {
	blocker := filepath.Join(t.TempDir(), "a-file")
	if err := os.WriteFile(blocker, nil, 0o600); err != nil {
		t.Fatal(err)
	}

	if err := excludeFromIndexing("darwin", filepath.Join(blocker, "workspaces")); err == nil {
		t.Fatal("a root that cannot be created should report why the marker could not be written")
	}
}
