// Package domain is what a session is: a place to run (a git worktree this
// runner made, or a folder already on the host), a tmux session in it, and
// the windows a browser opens onto that tmux session. It holds the state
// machine and the invariants; the tmux server, git and the screen classifier
// are all somewhere else.
package domain

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Prefix marks the tmux sessions this runner owns. It is how adoption tells
// our sessions from the user's own, and why a stray `kill-session` can never
// reach a tmux session a person created themselves.
const Prefix = "opp-"

// Socket is the dedicated tmux socket (`tmux -L oppenheimer`), so the runner
// never shares a server with the user's own tmux.
const Socket = "oppenheimer"

// State is where a session is. It is derived from events and from the screen
// classifier; the runner never invents one.
type State string

// States. `working`, `blocked`, `idle`, `done` and `unknown` come from the
// screen manifest; `creating`, `starting`, `stopped` and `closed` are
// lifecycle.
const (
	// StateCreating is a session whose create is still running: its store,
	// worktree or tmux session may not exist yet. It is only ever held in
	// memory, never saved and never reported, so a runner that dies
	// mid-create leaves no record claiming a session it never finished.
	StateCreating State = "creating"
	StateStarting State = "starting"
	StateWorking  State = "working"
	StateBlocked  State = "blocked"
	StateIdle     State = "idle"
	StateDone     State = "done"
	StateUnknown  State = "unknown"
	// StateStopped is a session whose tmux session is gone — after a host
	// reboot, say. Its worktree is intact and Restart recreates window 0.
	StateStopped State = "stopped"
	// StateClosed is a session that is over: its worktree removed, or, for a
	// folder session, its terminal ended.
	StateClosed State = "closed"
)

// Live reports a state whose tmux session should exist.
func (s State) Live() bool {
	switch s {
	case StateStarting, StateWorking, StateBlocked, StateIdle, StateDone, StateUnknown:
		return true
	case StateCreating, StateStopped, StateClosed:
		return false
	}
	return false
}

// Agent is the program window 0 runs.
type Agent string

// Agents. Claude Code is the MVP's first entry; Codex, OpenCode and Grok are
// the others, and the shell is the blank terminal with no agent in it.
const (
	AgentClaude   Agent = "claude"
	AgentCodex    Agent = "codex"
	AgentOpenCode Agent = "opencode"
	AgentGrok     Agent = "grok"
	AgentShell    Agent = "shell"
)

// agentCatalogIDs is the runner's view of the catalog's `CODING_AGENT_IDS`:
// each agent it can start and the catalog id the control plane names it by.
// It is the one table; Valid, CatalogID, AgentFromCatalogID and Command all
// read it, so a new agent is one row here and one in the catalog, and a
// test fails when the generated launch table has an id this map lacks.
var agentCatalogIDs = map[Agent]string{
	AgentClaude:   "claude-code",
	AgentCodex:    "codex",
	AgentOpenCode: "opencode",
	AgentGrok:     "grok",
	AgentShell:    "shell",
}

// Agents is every agent the runner knows how to start, in no promised order.
func Agents() []Agent {
	agents := make([]Agent, 0, len(agentCatalogIDs))
	for agent := range agentCatalogIDs {
		agents = append(agents, agent)
	}
	return agents
}

// Valid reports an agent the runner knows how to start.
func (a Agent) Valid() bool {
	_, ok := agentCatalogIDs[a]
	return ok
}

// CatalogID is the catalog's id for this agent, for snapshots the control
// plane reads; "" for anything the runner does not know, never a guess.
func (a Agent) CatalogID() string {
	return agentCatalogIDs[a]
}

// Command is what the agent is launched as: the catalog's `command`, empty
// for the blank terminal and for an agent the catalog has no row for.
func (a Agent) Command() string {
	return launchCatalog[a.CatalogID()].command
}

// AgentFromCatalogID maps a catalog agent id onto this runner's agent.
func AgentFromCatalogID(id string) (Agent, bool) {
	for agent, catalogID := range agentCatalogIDs {
		if catalogID == id {
			return agent, true
		}
	}
	return "", false
}

// Window is one tmux window in the session: window 0 is the agent, 1 and up
// are plain shells in the same worktree — the tabs of the session view.
type Window struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
	Agent bool   `json:"agent"`
}

// Session is the aggregate.
type Session struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Place is where the session runs: a worktree this runner made, or a
	// folder that was already on the host (24 §3).
	Place Place `json:"place"`
	// AccountID and WorkspaceID are the work folder's two levels the
	// session's folder and its stores sit under (24 §2): the control plane's
	// ids, or `local` for a session the CLI made. Empty for a folder session,
	// which owns nothing in the work folder.
	AccountID   string `json:"accountId,omitempty"`
	WorkspaceID string `json:"workspaceId,omitempty"`
	// Dir is a worktree session's own folder,
	// `<work folder>/<account>/<workspace>/sessions/<slug>`, which holds its
	// marker and its checkout. Empty for a folder session.
	Dir string `json:"dir,omitempty"`
	// Folder is a folder session's folder: the person's, never written to and
	// never deleted.
	Folder string `json:"folder,omitempty"`
	// Repo is `owner/name`. Empty for a folder session.
	Repo string `json:"repo,omitempty"`
	// BaseBranch is what the session's branch was cut from.
	BaseBranch string `json:"baseBranch,omitempty"`
	Branch     string `json:"branch,omitempty"`
	// Worktree is the absolute path of a worktree session's checkout,
	// `<Dir>/<directory name>`: where its agent runs. Empty for a folder
	// session.
	Worktree string `json:"worktree,omitempty"`
	Agent    Agent  `json:"agent"`
	// Launch is how window 0 was started, kept so Restart reproduces it.
	Launch Launch `json:"launch,omitzero"`
	// CheckoutID and GithubRepoID name the control plane's checkout row for
	// the repository, which is what a credential ask is keyed by. Empty for
	// a session the CLI made.
	CheckoutID   string `json:"checkoutId,omitempty"`
	GithubRepoID int64  `json:"githubRepoId,omitempty"`
	// More are the checkouts past the first, for a session over several
	// repositories: each one a worktree of its own store beside the first, in
	// the session's folder, on the same Branch. The first stays in the fields
	// above, so a state file an older runner wrote, which knew only one,
	// still loads as the session it was.
	More    []Checkout `json:"moreCheckouts,omitempty"`
	State   State      `json:"state"`
	Windows []Window   `json:"windows"`
	Created time.Time  `json:"created"`
	Updated time.Time  `json:"updated"`
	// LoginURL is the vendor login link the classifier saw, if any. The
	// console turns it into a button; nothing else is ever linkified (F3).
	LoginURL string `json:"loginUrl,omitempty"`
	// Dirty records that the worktree had uncommitted changes when it was
	// closed, so the console can say so instead of silently dropping work.
	Dirty bool `json:"dirty,omitempty"`
	// PromptReported records that the first message was read off the
	// agent's transcript and handed to the link as `prompt.first`, so a
	// runner that restarts never reports it a second time.
	PromptReported bool `json:"promptReported,omitempty"`
}

var (
	ErrRepoName     = errors.New("repository must be owner/name")
	ErrBranchName   = errors.New("branch name is not usable")
	ErrUnknownAgent = errors.New("unknown agent")
	ErrNotLive      = errors.New("session is not running")
	ErrClosed       = errors.New("session is closed")
	ErrNoSuchWindow = errors.New("no such window")
)

// Checkout is one repository a worktree session checked out: a worktree of
// that repository's store, in the session's folder, on the session's branch.
type Checkout struct {
	// Repo is `owner/name`.
	Repo string `json:"repo"`
	// BaseBranch is what the session's branch was cut from in this
	// repository.
	BaseBranch string `json:"baseBranch,omitempty"`
	// Worktree is the checkout's absolute path, `<Dir>/<directory name>`.
	Worktree string `json:"worktree"`
	// CheckoutID and GithubRepoID name the control plane's checkout row,
	// which a credential ask for this repository is keyed by. Empty for a
	// session the CLI made.
	CheckoutID   string `json:"checkoutId,omitempty"`
	GithubRepoID int64  `json:"githubRepoId,omitempty"`
}

// Checkouts is every checkout of a worktree session, the first one first;
// none for a folder session, or for one this host holds no record of.
func (s Session) Checkouts() []Checkout {
	if s.Place == PlaceFolder || (s.Repo == "" && s.Worktree == "" && s.CheckoutID == "") {
		return nil
	}
	first := Checkout{
		Repo: s.Repo, BaseBranch: s.BaseBranch, Worktree: s.Worktree,
		CheckoutID: s.CheckoutID, GithubRepoID: s.GithubRepoID,
	}
	return append([]Checkout{first}, s.More...)
}

// CheckoutFor is the checkout a git request for path is about. A session of
// one checkout answers it whatever the path, as it did before there could be
// more: a store fetched under a repository's old name still sends that name.
// With several, path picks one: it is what git hands a credential helper
// under `credential.useHttpPath`, `owner/name.git` for a GitHub remote,
// matched as GitHub matches names, without regard to case. No path, or one
// that names none of them, answers none rather than a token for the wrong
// repository.
func (s Session) CheckoutFor(path string) (Checkout, bool) {
	checkouts := s.Checkouts()
	if len(checkouts) == 1 {
		return checkouts[0], true
	}
	path = strings.TrimSuffix(strings.Trim(path, "/"), ".git")
	if path == "" {
		return Checkout{}, false
	}
	for _, checkout := range checkouts {
		if strings.EqualFold(checkout.Repo, path) {
			return checkout, true
		}
	}
	return Checkout{}, false
}

// Cwd is where the session's agent and its tabs run: the folder of a folder
// session; the checkout of a worktree session with one; the session's own
// folder for one with several, which holds each checkout as a subfolder, so
// the agent sees every repository it was given.
func (s Session) Cwd() string {
	if s.Place == PlaceFolder {
		return s.Folder
	}
	if len(s.More) > 0 {
		return s.Dir
	}
	return s.Worktree
}

// Repository names the store a worktree session's first checkout was made
// from.
func (s Session) Repository() Repository {
	return s.RepositoryOf(Checkout{Repo: s.Repo, GithubRepoID: s.GithubRepoID})
}

// RepositoryOf names the store one of the session's checkouts was made from.
func (s Session) RepositoryOf(checkout Checkout) Repository {
	return Repository{
		Tenant:   Tenant{Account: s.AccountID, Workspace: s.WorkspaceID},
		FullName: checkout.Repo, GithubID: checkout.GithubRepoID,
	}
}

// TmuxName is the tmux session name: the id, prefixed.
func (s Session) TmuxName() string { return Prefix + s.ID }

// Target addresses one window for tmux.
func (s Session) Target(window int) string {
	return fmt.Sprintf("%s:%d", s.TmuxName(), window)
}

// Window returns a window by index.
func (s Session) Window(index int) (Window, bool) {
	for _, w := range s.Windows {
		if w.Index == index {
			return w, true
		}
	}
	return Window{}, false
}

// NextWindow is the index a new tab gets: one past the highest, so closing a
// tab never makes a later one reuse its number while a client is attached.
func (s Session) NextWindow() int {
	next := 0
	for _, w := range s.Windows {
		if w.Index >= next {
			next = w.Index + 1
		}
	}
	return next
}

// Clone returns a session that shares nothing with this one. Copying the
// struct alone would hand the caller the same Windows backing array, and a
// caller that appended or edited a window would be editing the service's own
// state from outside it.
func (s Session) Clone() Session {
	s.Windows = append([]Window(nil), s.Windows...)
	if s.More != nil {
		s.More = append([]Checkout(nil), s.More...)
	}
	return s
}

// WithState returns a copy in a new state, stamped.
func (s Session) WithState(state State, now time.Time) Session {
	s.State, s.Updated = state, now
	return s
}

// ID generation: 12 random characters, lowercase base32 without padding, so a
// session id is unguessable (F25) and still fits a tmux session name, a
// branch name and a directory name without quoting.
var idEncoding = base32.NewEncoding("abcdefghijklmnopqrstuvwxyz234567").WithPadding(base32.NoPadding)

// NewID mints a session id.
func NewID() (string, error) {
	raw := make([]byte, 8)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return idEncoding.EncodeToString(raw)[:12], nil
}

// repoPattern is `owner/name` with the characters GitHub allows.
var repoPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}/[A-Za-z0-9._-]{1,100}$`)

// ValidateRepo refuses anything that would not be a safe directory name, and
// in particular anything that could walk out of the workspaces root.
func ValidateRepo(repo string) error {
	if !repoPattern.MatchString(repo) || strings.Contains(repo, "..") {
		return fmt.Errorf("%w: %q", ErrRepoName, repo)
	}
	return nil
}

// branchPattern keeps a branch to what git accepts and a shell needs no
// quoting for. It is deliberately narrower than git's own rules.
var branchPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$`)

// ValidateBranch refuses names git or the filesystem would fight over.
func ValidateBranch(branch string) error {
	switch {
	case !branchPattern.MatchString(branch),
		strings.Contains(branch, ".."),
		strings.HasSuffix(branch, "/"),
		strings.HasSuffix(branch, ".lock"):
		return fmt.Errorf("%w: %q", ErrBranchName, branch)
	}
	return nil
}

// Slug is the worktree directory's name for a session: the branch, flattened,
// with the id appended so two sessions on one branch never collide.
func Slug(branch, id string) string {
	flat := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, branch)
	flat = strings.Trim(flat, "-")
	if len(flat) > 40 {
		flat = flat[:40]
	}
	switch {
	case flat == "":
		return id
	case strings.HasSuffix(flat, id):
		// The default branch is already named after the session; repeating
		// the id would make the directory say it twice.
		return flat
	default:
		return flat + "-" + id
	}
}

// DefaultBranchName is what a session's own branch is called when the user
// did not name one: readable in a PR list, unique by construction.
func DefaultBranchName(id string) string { return "oppenheimer/" + id }
