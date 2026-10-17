package app_test

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/folders"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func lister(home string, dirs app.Directories) *app.Service {
	p := fake.New()
	p.Home = home
	return app.New(app.Options{Prober: p, Directories: dirs})
}

func mkdir(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o700); err != nil {
		t.Fatal(err)
	}
}

func write(t *testing.T, path, content string) {
	t.Helper()
	mkdir(t, filepath.Dir(path))
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

// The folder picker (24 §4) sees directories only, hidden ones left out,
// sorted as a person reads them, a link to a directory among them, and the
// branch of each one that is a checkout — read from what git wrote, the
// listed directory's own included.
func TestListFoldersNamesDirectoriesAndTheirBranches(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	mkdir(t, filepath.Join(home, "beta"))
	mkdir(t, filepath.Join(home, "Alpha"))
	mkdir(t, filepath.Join(home, ".config"))
	write(t, filepath.Join(home, "notes.txt"), "a file is never named")
	write(t, filepath.Join(home, "site", ".git", "HEAD"), "ref: refs/heads/feature/login\n")
	write(t, filepath.Join(root, "gitdirs", "wt", "HEAD"), "0123456789abcdef0123456789abcdef01234567\n")
	write(t, filepath.Join(home, "wt", ".git"), "gitdir: ../../gitdirs/wt\n")
	mkdir(t, filepath.Join(root, "elsewhere"))
	if err := os.Symlink(filepath.Join(root, "elsewhere"), filepath.Join(home, "linked")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "nowhere"), filepath.Join(home, "broken")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(home, ".git", "HEAD"), "ref: refs/heads/main\n")

	listing, err := lister(home, folders.Disk{}).ListFolders("")
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	if listing.Path != home || listing.Home != home || listing.Parent != root || listing.Branch != "main" {
		t.Fatalf("listing = path %q home %q parent %q branch %q", listing.Path, listing.Home, listing.Parent, listing.Branch)
	}
	var got []string
	for _, entry := range listing.Entries {
		got = append(got, entry.Name+"@"+entry.Branch)
	}
	want := "Alpha@ beta@ linked@ site@feature/login wt@0123456"
	if strings.Join(got, " ") != want {
		t.Fatalf("entries = %v, want %s", got, want)
	}
	if listing.Truncated {
		t.Fatal("a short listing says it was cut")
	}
}

func TestListFoldersAtTheRootHasNoParent(t *testing.T) {
	listing, err := lister("/root", folders.Disk{}).ListFolders("/")
	if err != nil {
		t.Fatal(err)
	}
	if listing.Path != "/" || listing.Parent != "" {
		t.Fatalf("path %q parent %q", listing.Path, listing.Parent)
	}
}

func TestListFoldersCapsTheEntriesAndSaysSo(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < domain.MaxFolderEntries+3; i++ {
		mkdir(t, filepath.Join(dir, fmt.Sprintf("d%04d", i)))
	}

	listing, err := lister(dir, folders.Disk{}).ListFolders(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(listing.Entries) != domain.MaxFolderEntries || !listing.Truncated {
		t.Fatalf("%d entries, truncated %v", len(listing.Entries), listing.Truncated)
	}
}

// unreadable answers every listing with a permission error, which running as
// root makes impossible to stage with a mode.
type unreadable struct{}

func (unreadable) Subdirectories(dir string) ([]string, error) {
	return nil, &fs.PathError{Op: "open", Path: dir, Err: fs.ErrPermission}
}
func (unreadable) Branch(string) string { return "" }

// Each way a listing fails has the protocol's own code, so the picker can
// say which (fsListSchema: FS_001, FS_002, FS_003).
func TestListFoldersFailsWithTheProtocolsCodes(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "file.txt"), "x")
	for _, tc := range []struct {
		name string
		svc  *app.Service
		path string
		code string
	}{
		{"missing", lister(dir, folders.Disk{}), filepath.Join(dir, "missing"), domain.ErrFolderNotFound.Code},
		{"relative", lister(dir, folders.Disk{}), "code", domain.ErrFolderNotFound.Code},
		{"a file", lister(dir, folders.Disk{}), filepath.Join(dir, "file.txt"), domain.ErrFolderNotDir.Code},
		{"unreadable", lister(dir, unreadable{}), dir, domain.ErrFolderUnreadable.Code},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.svc.ListFolders(tc.path)
			var prob *problem.Error
			if !errors.As(err, &prob) || prob.Code != tc.code {
				t.Fatalf("err = %v, want %s", err, tc.code)
			}
		})
	}
}
