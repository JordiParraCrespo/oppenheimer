package domain

import (
	"errors"
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrNotFound      = problem.New("SESS_001", http.StatusNotFound, "Session not found")
	ErrInvalidInput  = problem.New("SESS_002", http.StatusBadRequest, "The session cannot be created with those values")
	ErrNotRunning    = problem.New("SESS_003", http.StatusConflict, "The session is not running")
	ErrTmux          = problem.New("TMUX_001", http.StatusFailedDependency, "tmux is not available on this host")
	ErrTmuxCommand   = problem.New("TMUX_002", http.StatusInternalServerError, "The tmux server refused the command")
	ErrWorktree      = problem.New("GIT_001", http.StatusInternalServerError, "The worktree could not be prepared")
	ErrGitCommand    = problem.New("GIT_002", http.StatusInternalServerError, "A git command failed")
	ErrPushRejected  = problem.New("GIT_003", http.StatusConflict, "The branch could not be pushed")
	ErrSessionExists = problem.New("SESS_004", http.StatusConflict, "A session already exists for that worktree")
	// ErrGitCredential is git asking for a credential the runner had none to
	// give: a private repository, and no token for the session it is for.
	ErrGitCredential = problem.New("GIT_004", http.StatusForbidden, "The repository needs a credential the runner could not supply")
	// ErrGitAbandoned is a git command whose context ended before it did —
	// the runner stopped waiting, git did not fail — so what it did first may
	// be on disk.
	ErrGitAbandoned = problem.New("GIT_005", http.StatusServiceUnavailable, "A git command was abandoned before it finished")
	ErrFile         = problem.New("SESS_005", http.StatusUnsupportedMediaType, "The file cannot be given to the session")
	// ErrFolderMissing and ErrFolderNotDirectory refuse a folder session
	// whose folder went away, or was never a directory, between the picker
	// and the create (24 §4).
	ErrFolderMissing      = problem.New("SESS_006", http.StatusNotFound, "The session's folder is not on this host")
	ErrFolderNotDirectory = problem.New("SESS_007", http.StatusBadRequest, "The session's folder is not a directory")
	// ErrCloudStart is `claude --cloud` ending without naming the cloud
	// session it made: not signed in to claude.ai, no access to the
	// repository there, or a CLI too old to know the flag. Its detail is
	// the CLI's own last words.
	ErrCloudStart = problem.New("SESS_008", http.StatusBadGateway, "Claude Code could not start the session in the cloud")
	// ErrCodexCloudStart is `codex cloud` refusing or failing: not signed in
	// to ChatGPT, no Codex cloud environment for the repository, or a CLI too
	// old to know the command. Its detail is the CLI's own last words.
	ErrCodexCloudStart = problem.New("SESS_009", http.StatusBadGateway, "Codex could not start the task in the cloud")
	// ErrCodexCloudEnvironment is `codex cloud exec` finding no environment
	// under any label tried for the repository. The CLI resolves only the
	// environments its TUI lists; one made in ChatGPT's Settings → Codex
	// Cloud is not among them yet. Its detail names the labels tried and the
	// ones the CLI showed in the account's recent tasks.
	ErrCodexCloudEnvironment = problem.New("SESS_010", http.StatusNotFound, "No Codex cloud environment the CLI can reach is named for the repository")
	// ErrCodexRateLimited is ChatGPT refusing a read of the account's Codex
	// environments for rate: nothing more is asked of it for that account
	// until the time it named has passed.
	ErrCodexRateLimited = problem.New("SESS_011", http.StatusTooManyRequests, "ChatGPT asked the host to wait before listing Codex environments")
	// ErrInvalidPattern refuses a terminal watch whose pattern is empty, too
	// long or not an RE2 expression. The code is the protocol's
	// (`session.watch`), not a SESS_ number: the control plane names it.
	ErrInvalidPattern = problem.New("INVALID_PATTERN", http.StatusBadRequest, "The watch pattern is not a valid expression")
)

// Sentinels a Places adapter answers with; the use case maps them onto the
// catalog.
var (
	// ErrNoSuchFolder is a path with nothing at it.
	ErrNoSuchFolder = errors.New("no such folder")
	// ErrNotADirectory is a path with something other than a directory at it.
	ErrNotADirectory = errors.New("not a directory")
	// ErrNotOurs is a folder whose marker names something else, or that has
	// none: the runner did not make it for this session, so it never deletes it.
	ErrNotOurs = errors.New("the folder is not this session's")
)
