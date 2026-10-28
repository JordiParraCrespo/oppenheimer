package domain

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Place is where a session runs (24 §3).
type Place string

// Places. The blank terminal is an agent (AgentShell), not a place: it runs
// in either.
const (
	// PlaceWorktree is a session in a worktree this runner cut for it, under
	// the work folder, removed when the session closes.
	PlaceWorktree Place = "worktree"
	// PlaceFolder is a session in a folder that was already on the host: the
	// person's, never written to and never deleted.
	PlaceFolder Place = "folder"
)

// LayoutVersion is the work folder's layout, written to `layout.json` at its
// root. A runner on this layout ignores whatever an older one left.
const LayoutVersion = 3

// LocalID names the account and the workspace levels of a session made from
// the host's own CLI, which no control plane has given an id.
const LocalID = "local"

// Tenant is the account and the workspace something in the work folder belongs
// to: the two levels above `repos.noindex/` and `sessions.noindex/`, each
// named by an id that never changes (24 §2).
type Tenant struct {
	Account   string
	Workspace string
}

// LocalTenant is where the CLI's sessions and stores live.
var LocalTenant = Tenant{Account: LocalID, Workspace: LocalID}

// Validate refuses an account or workspace id that is not one plain directory
// name.
func (t Tenant) Validate() error {
	if err := ValidateName(t.Account); err != nil {
		return fmt.Errorf("account: %w", err)
	}
	if err := ValidateName(t.Workspace); err != nil {
		return fmt.Errorf("workspace: %w", err)
	}
	return nil
}

// Repository names one repository's store on this host: the workspace that
// holds it and the GitHub repository it caches.
type Repository struct {
	Tenant Tenant
	// FullName is `owner/name`, which is what the store is called.
	FullName string
	// GithubID is GitHub's id for the repository, recorded in the store
	// (`oppenheimer.repo-id`), so a renamed repository keeps its store. Zero
	// for one the CLI named.
	GithubID int64
}

// Validate refuses a repository whose store could not be named safely.
func (r Repository) Validate() error {
	if err := r.Tenant.Validate(); err != nil {
		return err
	}
	return ValidateRepo(r.FullName)
}

// SessionFolder is what a worktree session's folder records about itself in
// its marker, `.oppenheimer/meta.json`: the marker is how a runner tells a
// folder it made from anything else, and only a folder whose marker names
// the session is ever deleted with it.
type SessionFolder struct {
	// Dir is the folder, `Layout.Session(Tenant, slug)`.
	Dir       string
	SessionID string
	Tenant    Tenant
	// WorkspaceSlug is recorded in the workspace folder's marker; it may be
	// empty, and it names nothing on disk.
	WorkspaceSlug string
	Created       time.Time
}

// ErrName is a path element that is not one plain directory name.
var ErrName = errors.New("name is not usable as a directory")

// namePattern is one directory name: no separator, nothing hidden, nothing a
// shell or a URL needs quoting for.
var namePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// ValidateName refuses anything but one plain, visible directory name — in
// particular anything that could walk out of the directory it is joined to.
func ValidateName(name string) error {
	if !namePattern.MatchString(name) || strings.Contains(name, "..") {
		return fmt.Errorf("%w: %q", ErrName, name)
	}
	return nil
}

// Layout is the work folder: where stores and sessions live on a host, and
// the only place that decides it (24 §2).
//
//	<root>/layout.json                                   {"version": 3}
//	<root>/<account>/.oppenheimer/meta.json              {"kind":"account"}
//	<root>/<account>/<workspace>/.oppenheimer/meta.json  {"kind":"workspace"}
//	<root>/<account>/<workspace>/repos.noindex/<owner>--<repo>.git        a bare store
//	<root>/<account>/<workspace>/repos.noindex/.spares/<owner>--<repo>    the spare worktree
//	<root>/<account>/<workspace>/sessions.noindex/<slug>/.oppenheimer/meta.json
//	<root>/<account>/<workspace>/sessions.noindex/<slug>/<directory>      a checkout
//
// The two directories that hold checkouts end in `.noindex`, the suffix
// Spotlight skips along with everything below it (Xcode's DerivedData uses it
// the same way). A worktree is a whole checkout, `node_modules` included,
// rewritten whenever an agent installs something; indexed, `mdworker_shared`
// outspends the agents on a macOS host. `.metadata_never_index` at the root
// does not keep Spotlight out (MVP decision log, 2026-10-01), so the name has
// to. Elsewhere the suffix is only a name.
type Layout struct{ Root string }

// NoIndex is the suffix Spotlight skips a directory by.
const NoIndex = ".noindex"

// Account is an account's folder.
func (l Layout) Account(account string) string {
	return filepath.Join(l.Root, account)
}

// Workspace is a workspace's folder, inside its account's.
func (l Layout) Workspace(t Tenant) string {
	return filepath.Join(l.Root, t.Account, t.Workspace)
}

// Repos is the directory a workspace's stores are in.
func (l Layout) Repos(t Tenant) string {
	return filepath.Join(l.Workspace(t), "repos"+NoIndex)
}

// Store is where a repository's bare store is made: `<owner>--<repo>.git`. A
// store that already exists under another name (the repository was renamed)
// is found by its GitHub id instead; that is the git adapter's to look for.
func (l Layout) Store(r Repository) string {
	return filepath.Join(l.Repos(r.Tenant), StoreName(r.FullName)+".git")
}

// Spare is the spare worktree of the store at store: `.spares/<name>` beside
// it, named after the store, so a renamed repository's spare follows its store.
func (l Layout) Spare(store string) string {
	return filepath.Join(filepath.Dir(store), ".spares", strings.TrimSuffix(filepath.Base(store), ".git"))
}

// Sessions is the directory a workspace's sessions are in.
func (l Layout) Sessions(t Tenant) string {
	return filepath.Join(l.Workspace(t), "sessions"+NoIndex)
}

// Session is one session's folder.
func (l Layout) Session(t Tenant, slug string) string {
	return filepath.Join(l.Sessions(t), slug)
}

// StoreName flattens `owner/name` into one directory name, `owner--name`.
// GitHub allows neither a `/` in a name nor a `--` that could make two
// repositories collide: an owner cannot end in `-`.
func StoreName(repo string) string {
	return strings.Replace(repo, "/", "--", 1)
}

// DirectoryOf is the checkout's directory name when the control plane named
// none: the repository's own name.
func DirectoryOf(repo string) string {
	_, name, found := strings.Cut(repo, "/")
	if !found {
		return repo
	}
	return name
}
