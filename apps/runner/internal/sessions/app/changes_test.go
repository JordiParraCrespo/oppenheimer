package app_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// A read keeps to its bounds: the files past the file bound are counted and
// left out, patches are read in order until their bytes run out, a patch
// longer than one file's bound is left out with its counts kept, and a
// binary file is never read for one. The regression this guards: an answer
// past the link's frame, which the runner refuses to send and the console
// waits on until it times out.
func TestAChangesReadKeepsToItsBounds(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	h.worktrees.Changed = map[string]domain.CheckoutChanges{session.Worktree: {
		Base: strings.Repeat("a", 40),
		Files: []domain.ChangedFile{
			{Path: "a.go", Status: domain.ChangeModified, Additions: 1},
			{Path: "long.go", Status: domain.ChangeModified, Additions: 900},
			{Path: "logo.png", Status: domain.ChangeAdded, Binary: true},
			{Path: "b.go", Status: domain.ChangeModified, Additions: 1},
			{Path: "c.go", Status: domain.ChangeAdded, Additions: 1},
			{Path: "past.go", Status: domain.ChangeAdded, Additions: 1},
		},
	}}
	h.worktrees.Patches = map[string]map[string]string{session.Worktree: {
		"a.go":    strings.Repeat("a", 40),
		"long.go": strings.Repeat("l", 200),
		"b.go":    strings.Repeat("b", 40),
		"c.go":    strings.Repeat("c", 40),
		"past.go": "never read",
	}}

	read, err := h.svc.ReadChanges(context.Background(), session.ID, false,
		domain.ChangesBounds{Files: 5, FilePatch: 100, Patches: 90})
	if err != nil {
		t.Fatal(err)
	}
	if len(read) != 1 || read[0].Checkout.Repo != "jordi/oppenheimer" || read[0].Checkout.BaseBranch != "main" {
		t.Fatalf("read = %+v; want the session's one checkout", read)
	}
	files, want := read[0].Files, map[string]bool{"a.go": true, "long.go": false, "logo.png": false, "b.go": true, "c.go": false}
	if len(files) != 5 || read[0].OmittedFiles != 1 {
		t.Fatalf("files = %d omitted = %d; want 5 and 1", len(files), read[0].OmittedFiles)
	}
	for _, f := range files {
		if got := f.Patch != ""; got != want[f.Path] {
			t.Errorf("%s: patch read = %v, want %v", f.Path, got, want[f.Path])
		}
		if f.Patch == "" && !f.Binary && !f.PatchOmitted {
			t.Errorf("%s: no patch and not marked left out", f.Path)
		}
	}
	if asked := h.worktrees.ChangesAsked; len(asked) != 1 || asked[0] != session.Worktree+" main false" {
		t.Fatalf("asked = %v; want the worktree against main", asked)
	}
}

// A session the host does not hold is refused as not found, which the link
// answers as SESS_001.
func TestReadingTheChangesOfAnUnknownSessionIsNotFound(t *testing.T) {
	h := newFakeHarness(t)
	_, err := h.svc.ReadChanges(context.Background(), "7d3e5a10-0000-4000-8000-000000000000", false,
		domain.ChangesBounds{Files: 5, FilePatch: 100, Patches: 100})
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != domain.ErrNotFound.Code {
		t.Fatalf("err = %v; want %s", err, domain.ErrNotFound.Code)
	}
}
