// Package workfolder is app.Places on disk: the work folder's own bookkeeping
// (24 §2) and the check a folder session's folder gets (24 §3).
//
// Every folder the runner makes in the work folder carries `.oppenheimer/`,
// the one hidden name a managed folder has, whose `meta.json` says what the
// folder is and whose it is. That marker is written before anything else goes
// into the folder, and only a folder whose marker names the session being
// closed is ever deleted: a folder without one is somebody else's.
package workfolder

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Places = (*Folder)(nil)

// Names inside the work folder.
const (
	// LayoutFile is at the work folder's root and says which layout it is on.
	LayoutFile = "layout.json"
	// MarkerDir holds a managed folder's marker.
	MarkerDir = ".oppenheimer"
	// MarkerFile is the marker: what the folder is, and whose.
	MarkerFile = "meta.json"
)

// Kinds a marker names.
const (
	KindAccount   = "account"
	KindWorkspace = "workspace"
	KindSession   = "session"
)

// Meta is a marker's content.
type Meta struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	// Slug is a workspace's slug, for a person reading the work folder; the
	// folder is named by the id, which never changes.
	Slug      string     `json:"slug,omitempty"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

// Folder is the work folder at a root.
type Folder struct {
	layout domain.Layout
	now    func() time.Time
}

// Options configure the work folder.
type Options struct {
	Layout domain.Layout
	Now    func() time.Time
}

// New builds the work folder. Nothing is written until something is made.
func New(opts Options) *Folder {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	return &Folder{layout: opts.Layout, now: now}
}

// Init makes the work folder's root, 0700, and says which layout it is on
// (`layout.json`, {"version": 3}) when nothing says so yet. A file that is
// there is left as it is.
func (f *Folder) Init() error {
	if err := os.MkdirAll(f.layout.Root, 0o700); err != nil {
		return err
	}
	path := filepath.Join(f.layout.Root, LayoutFile)
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	data, err := json.Marshal(map[string]int{"version": domain.LayoutVersion})
	if err != nil {
		return err
	}
	return writeAtomic(path, append(data, '\n'))
}

// MakeWorkspace makes an account's and a workspace's folders, each with its
// marker, when they are new. A workspace marker that lacks slug, or has
// another one (a slug can be edited), is brought up to date; the folder's
// name never changes.
func (f *Folder) MakeWorkspace(t domain.Tenant, slug string) error {
	if err := t.Validate(); err != nil {
		return domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}
	if err := f.Init(); err != nil {
		return failed("create the work folder", f.layout.Root, err)
	}
	if err := ensureMarked(f.layout.Account(t.Account), Meta{Kind: KindAccount, ID: t.Account}, false); err != nil {
		return err
	}
	return ensureMarked(f.layout.Workspace(t), Meta{Kind: KindWorkspace, ID: t.Workspace, Slug: slug}, slug != "")
}

// MakeSession implements app.Places.
func (f *Folder) MakeSession(folder domain.SessionFolder) error {
	if err := f.MakeWorkspace(folder.Tenant, folder.WorkspaceSlug); err != nil {
		return err
	}
	parent := filepath.Dir(folder.Dir)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return failed("create", parent, err)
	}
	created := folder.Created
	if created.IsZero() {
		created = f.now()
	}
	created = created.UTC()
	meta := Meta{Kind: KindSession, ID: folder.SessionID, CreatedAt: &created}

	err := os.Mkdir(folder.Dir, 0o700)
	switch {
	case err == nil:
	case errors.Is(err, fs.ErrExist):
		// An earlier attempt at this create made it: its marker names this
		// session. A folder with no marker and nothing in it is that attempt
		// cut short between the two, and is taken over too. Anything else
		// is not ours to take.
		found, readErr := readMarker(folder.Dir)
		switch {
		case readErr == nil && found.Kind == KindSession && found.ID == folder.SessionID:
			return nil
		case errors.Is(readErr, fs.ErrNotExist) && isEmptyDir(folder.Dir):
		default:
			return domain.ErrSessionExists.WithDetail(
				"%s already exists and is not session %s's folder", folder.Dir, folder.SessionID)
		}
	default:
		return failed("create", folder.Dir, err)
	}
	if err := writeMarker(folder.Dir, meta); err != nil {
		// The folder is empty: nothing to keep, and a folder with no marker
		// would never be the runner's to delete again.
		_ = os.Remove(folder.Dir)
		return failed("mark", folder.Dir, err)
	}
	return nil
}

// RemoveSession implements app.Places.
func (f *Folder) RemoveSession(dir, sessionID string) error {
	if _, err := os.Lstat(dir); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	meta, err := readMarker(dir)
	if err != nil || meta.Kind != KindSession || meta.ID != sessionID {
		return fmt.Errorf("%s: %w", dir, domain.ErrNotOurs)
	}
	if err := os.RemoveAll(dir); err != nil {
		return failed("remove", dir, err)
	}
	return nil
}

// CheckFolder implements app.Places. It follows a symlink: a link to a
// directory is a directory to run in.
func (f *Folder) CheckFolder(path string) error {
	info, err := os.Stat(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return fmt.Errorf("%s: %w", path, domain.ErrNoSuchFolder)
	case err != nil:
		return err
	case !info.IsDir():
		return fmt.Errorf("%s: %w", path, domain.ErrNotADirectory)
	}
	return nil
}

// ensureMarked makes dir with its marker when it is new, and writes the
// marker into a dir that has none. update rewrites a marker of the same kind
// and id whose fields differ.
func ensureMarked(dir string, meta Meta, update bool) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return failed("create", dir, err)
	}
	found, err := readMarker(dir)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		// A marker that does not parse is somebody's edit: left as it is.
		return nil //nolint:nilerr // not ours to rewrite, and no reason to refuse the create
	case !update || found == meta:
		return nil
	case found.Kind != meta.Kind || found.ID != meta.ID:
		return nil
	}
	if err := writeMarker(dir, meta); err != nil {
		return failed("mark", dir, err)
	}
	return nil
}

// readMarker reads dir's marker; fs.ErrNotExist when it has none.
func readMarker(dir string) (Meta, error) {
	data, err := os.ReadFile(filepath.Join(dir, MarkerDir, MarkerFile)) // #nosec G304 -- a fixed name under a folder of the work folder
	if err != nil {
		return Meta{}, err
	}
	var meta Meta
	if err := json.Unmarshal(data, &meta); err != nil {
		return Meta{}, err
	}
	return meta, nil
}

func writeMarker(dir string, meta Meta) error {
	marker := filepath.Join(dir, MarkerDir)
	if err := os.MkdirAll(marker, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(marker, MarkerFile), append(data, '\n'))
}

// writeAtomic writes path through a temporary file renamed over it, so a
// reader never finds half a file.
func writeAtomic(path string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+"-*")
	if err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	return nil
}

func isEmptyDir(path string) bool {
	entries, err := os.ReadDir(path)
	return err == nil && len(entries) == 0
}

// failed is a filesystem step that failed: verb names it ("create"), path
// says where.
func failed(verb, path string, err error) error {
	return domain.ErrWorktree.WithDetail("%s %s: %v", verb, path, err).WithCause(err)
}
