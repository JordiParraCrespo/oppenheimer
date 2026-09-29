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

func TestExcludeFromIndexingSaysWhenItCannotWrite(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "never-created")

	if err := excludeFromIndexing("darwin", dir); err == nil {
		t.Fatal("a directory that does not exist should report why the marker could not be written")
	}
}
