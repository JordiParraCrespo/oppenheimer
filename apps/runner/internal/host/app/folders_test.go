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

// The picker's search finds a folder by any part of its name, a few levels
// down, best match first; it finds a repository but never what is inside it,
// and it neither names nor walks hidden directories or dependency trees.
func TestFindFoldersFindsByNameAndStopsAtRepositories(t *testing.T) {
	home := t.TempDir()
	mkdir(t, filepath.Join(home, "code", "acme", "my-billing-ui"))
	write(t, filepath.Join(home, "code", "acme", "billing", ".git", "HEAD"), "ref: refs/heads/main\n")
	mkdir(t, filepath.Join(home, "code", "acme", "billing", "packages", "billing-core"))
	mkdir(t, filepath.Join(home, "Billing"))
	mkdir(t, filepath.Join(home, ".cache", "billing"))
	mkdir(t, filepath.Join(home, "app", "node_modules", "billing"))
	mkdir(t, filepath.Join(home, "a", "b", "c", "d", "billing"))
	mkdir(t, filepath.Join(home, "notes"))

	search, err := lister(home, folders.Disk{}).FindFolders("", "  BILL ")
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, entry := range search.Entries {
		rel, _ := filepath.Rel(home, entry.Path)
		got = append(got, rel+"@"+entry.Branch)
	}
	want := "Billing@ code/acme/billing@main code/acme/my-billing-ui@"
	if strings.Join(got, " ") != want {
		t.Fatalf("found %v, want %s", got, want)
	}
	if search.Path != home || search.Home != home || search.Truncated {
		t.Fatalf("search = path %q home %q truncated %v", search.Path, search.Home, search.Truncated)
	}
}

// More matches than an answer carries are cut to the best, and the answer
// says so, so the picker can ask for a longer name.
func TestFindFoldersCapsTheResultsAndSaysSo(t *testing.T) {
	home := t.TempDir()
	for i := 0; i < domain.MaxFoundFolder+5; i++ {
		mkdir(t, filepath.Join(home, fmt.Sprintf("app%03d", i)))
	}

	search, err := lister(home, folders.Disk{}).FindFolders("", "app")
	if err != nil {
		t.Fatal(err)
	}
	if len(search.Entries) != domain.MaxFoundFolder || !search.Truncated {
		t.Fatalf("%d entries, truncated %v", len(search.Entries), search.Truncated)
	}
}

// Where a search starts fails the way a listing does; below it, a folder that
// cannot be read is passed over rather than failing the search.
func TestFindFoldersFailsOnlyOnItsStart(t *testing.T) {
	dir := t.TempDir()
	_, err := lister(dir, folders.Disk{}).FindFolders(filepath.Join(dir, "missing"), "x")
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != domain.ErrFolderNotFound.Code {
		t.Fatalf("err = %v, want FS_001", err)
	}
	if _, err := lister(dir, unreadable{}).FindFolders(dir, "x"); !errors.As(err, &prob) || prob.Code != domain.ErrFolderUnreadable.Code {
		t.Fatalf("err = %v, want FS_003", err)
	}
}
