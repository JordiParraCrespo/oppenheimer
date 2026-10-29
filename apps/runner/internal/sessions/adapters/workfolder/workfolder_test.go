package workfolder_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/workfolder"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

var tenant = domain.Tenant{Account: "acct-1", Workspace: "ws-1"}

func setup(t *testing.T) (*workfolder.Folder, domain.Layout) {
	t.Helper()
	layout := domain.Layout{Root: filepath.Join(t.TempDir(), "oppenheimer")}
	return workfolder.New(workfolder.Options{Layout: layout}), layout
}

func meta(t *testing.T, dir string) workfolder.Meta {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, ".oppenheimer", "meta.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m workfolder.Meta
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func session(layout domain.Layout, id, slug string) domain.SessionFolder {
	return domain.SessionFolder{
		Dir: layout.Session(tenant, slug), SessionID: id, Tenant: tenant, WorkspaceSlug: "acme",
		Created: time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC),
	}
}

// Making a session's folder marks every level it makes (24 §2): the work
// folder says its layout, the account and workspace folders say what they
// are, and the session folder names its session before anything else is in
// it.
func TestMakingASessionFolderMarksEveryLevel(t *testing.T) {
	f, layout := setup(t)
	folder := session(layout, "sess-1", "fix-login")

	if err := f.MakeSession(folder); err != nil {
		t.Fatalf("make: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(layout.Root, "layout.json"))
	if err != nil || string(data) != "{\"version\":3}\n" {
		t.Fatalf("layout.json = %q, %v", data, err)
	}
	if m := meta(t, layout.Account("acct-1")); m.Kind != "account" || m.ID != "acct-1" {
		t.Fatalf("account marker = %+v", m)
	}
	if m := meta(t, layout.Workspace(tenant)); m.Kind != "workspace" || m.ID != "ws-1" || m.Slug != "acme" {
		t.Fatalf("workspace marker = %+v", m)
	}
	m := meta(t, folder.Dir)
	if m.Kind != "session" || m.ID != "sess-1" || m.CreatedAt == nil || !m.CreatedAt.Equal(folder.Created) {
		t.Fatalf("session marker = %+v", m)
	}
	entries, _ := os.ReadDir(folder.Dir)
	if len(entries) != 1 || entries[0].Name() != ".oppenheimer" {
		t.Fatalf("the session's folder holds %v, want only its marker", entries)
	}
	if info, _ := os.Stat(folder.Dir); info.Mode().Perm() != 0o700 {
		t.Fatalf("mode = %v, want 0700", info.Mode().Perm())
	}
}

// A create sent again for the same session takes over the folder the first
// attempt made; another session's folder, or a folder with something in it
// and no marker, is never taken.
func TestASessionFolderIsTakenOverOnlyByItsOwnSession(t *testing.T) {
	f, layout := setup(t)
	if err := f.MakeSession(session(layout, "sess-1", "taken")); err != nil {
		t.Fatal(err)
	}
	if err := f.MakeSession(session(layout, "sess-1", "taken")); err != nil {
		t.Fatalf("the same session's second attempt: %v", err)
	}

	var prob *problem.Error
	if err := f.MakeSession(session(layout, "sess-2", "taken")); !errors.As(err, &prob) || prob.Code != domain.ErrSessionExists.Code {
		t.Fatalf("another session's folder: err = %v, want %s", err, domain.ErrSessionExists.Code)
	}

	stranger := session(layout, "sess-3", "strangers")
	if err := os.MkdirAll(stranger.Dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stranger.Dir, "theirs.txt"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := f.MakeSession(stranger); !errors.As(err, &prob) || prob.Code != domain.ErrSessionExists.Code {
		t.Fatalf("an unmarked folder: err = %v, want %s", err, domain.ErrSessionExists.Code)
	}

	// An empty folder with no marker is an attempt cut short between making
	// the folder and marking it: taken over.
	cut := session(layout, "sess-4", "cut-short")
	if err := os.MkdirAll(cut.Dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := f.MakeSession(cut); err != nil {
		t.Fatalf("an empty unmarked folder: %v", err)
	}
	if m := meta(t, cut.Dir); m.ID != "sess-4" {
		t.Fatalf("marker = %+v", m)
	}
}

// Only a folder whose marker names the session is removed with it: a folder
// with no marker, or another session's, is somebody's and is left whole.
func TestASessionFolderIsRemovedOnlyWhenItsMarkerNamesTheSession(t *testing.T) {
	f, layout := setup(t)
	mine := session(layout, "sess-1", "mine")
	if err := f.MakeSession(mine); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(mine.Dir, "left-behind.txt"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := f.RemoveSession(mine.Dir, "sess-2"); !errors.Is(err, domain.ErrNotOurs) {
		t.Fatalf("removing as another session: err = %v, want ErrNotOurs", err)
	}
	if _, err := os.Stat(mine.Dir); err != nil {
		t.Fatalf("another session's close removed the folder: %v", err)
	}

	unmarked := layout.Session(tenant, "unmarked")
	if err := os.MkdirAll(unmarked, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := f.RemoveSession(unmarked, "sess-1"); !errors.Is(err, domain.ErrNotOurs) {
		t.Fatalf("removing an unmarked folder: err = %v, want ErrNotOurs", err)
	}
	if _, err := os.Stat(unmarked); err != nil {
		t.Fatalf("an unmarked folder was removed: %v", err)
	}

	if err := f.RemoveSession(mine.Dir, "sess-1"); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(mine.Dir); !os.IsNotExist(err) {
		t.Fatalf("the session's folder is still there: %v", err)
	}
	if err := f.RemoveSession(mine.Dir, "sess-1"); err != nil {
		t.Fatalf("removing a folder already gone: %v", err)
	}
}

// A folder session's folder must be a directory that exists; a symlink to
// one is one.
func TestCheckFolderWantsAnExistingDirectory(t *testing.T) {
	f, _ := setup(t)
	dir := t.TempDir()
	file := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(file, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "link")
	if err := os.Symlink(dir, link); err != nil {
		t.Fatal(err)
	}

	if err := f.CheckFolder(dir); err != nil {
		t.Fatalf("a directory: %v", err)
	}
	if err := f.CheckFolder(link); err != nil {
		t.Fatalf("a link to a directory: %v", err)
	}
	if err := f.CheckFolder(file); !errors.Is(err, domain.ErrNotADirectory) {
		t.Fatalf("a file: %v", err)
	}
	if err := f.CheckFolder(filepath.Join(dir, "missing")); !errors.Is(err, domain.ErrNoSuchFolder) {
		t.Fatalf("a missing path: %v", err)
	}
}

// layout.json is written once; a workspace marker follows its slug.
func TestInitLeavesALayoutFileAndAWorkspaceKeepsItsSlugCurrent(t *testing.T) {
	f, layout := setup(t)
	if err := f.Init(); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(layout.Root, "layout.json")
	if err := os.WriteFile(path, []byte(`{"version":2,"note":"mine"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := f.Init(); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(path); string(data) != `{"version":2,"note":"mine"}` {
		t.Fatalf("layout.json was rewritten: %s", data)
	}

	if err := f.MakeWorkspace(tenant, ""); err != nil {
		t.Fatal(err)
	}
	if err := f.MakeWorkspace(tenant, "renamed"); err != nil {
		t.Fatal(err)
	}
	if m := meta(t, layout.Workspace(tenant)); m.Slug != "renamed" {
		t.Fatalf("workspace marker = %+v", m)
	}
	if err := f.MakeWorkspace(tenant, ""); err != nil {
		t.Fatal(err)
	}
	if m := meta(t, layout.Workspace(tenant)); m.Slug != "renamed" {
		t.Fatalf("a create with no slug dropped it: %+v", m)
	}
}
