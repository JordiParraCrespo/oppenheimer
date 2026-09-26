package domain

import (
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
	ErrImage        = problem.New("SESS_005", http.StatusUnsupportedMediaType, "The image cannot be given to the session")
)
