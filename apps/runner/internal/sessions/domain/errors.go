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
	// session it made: no access to the repository on claude.ai, or a CLI
	// too old to know the flag (not signed in is ErrCloudSignIn). Its detail is
	// the CLI's own last words.
	ErrCloudStart = problem.New("SESS_008", http.StatusBadGateway, "Claude Code could not start the session in the cloud")
	// ErrCloudSignIn is `claude --cloud` refusing because the host's Claude
	// Code has no claude.ai account signed in: the one SESS_008 the person
	// fixes on the host, with `claude auth login`. Its detail is the CLI's
	// own last words.
	ErrCloudSignIn = problem.New("SESS_019", http.StatusBadGateway, "Claude Code on this host is not signed in to claude.ai")
	// ErrCodexCloudStart is `codex cloud` refusing or failing for a reason
	// that has no code of its own (a CLI too old to know the command, ChatGPT
	// unreachable). Its detail is the CLI's own last words.
	ErrCodexCloudStart = problem.New("SESS_009", http.StatusBadGateway, "Codex could not start the task in the cloud")
	// ErrCodexCloudEnvironment is `codex cloud exec` finding no environment
	// under the one picked or any label tried for the repository. The CLI
	// resolves only the environments its TUI lists, ChatGPT's Codex Cloud
	// (Legacy); one made in ChatGPT's Settings → Codex Cloud is not among
	// them. Its detail names what was tried and the environments the CLI
	// showed instead.
	ErrCodexCloudEnvironment = problem.New("SESS_010", http.StatusNotFound, "No Codex cloud environment the CLI can reach is named for the repository")
	// ErrCodexRateLimited is ChatGPT refusing a read of the account's Codex
	// environments for rate: nothing more is asked of it for that account
	// until the time it named has passed.
	ErrCodexRateLimited = problem.New("SESS_011", http.StatusTooManyRequests, "ChatGPT asked the host to wait before listing Codex environments")
	// ErrCodexCloudSignIn is the host's `codex` holding no ChatGPT sign-in,
	// which every cloud command needs (an API key does not reach Codex cloud).
	// Its detail is the CLI's own last words.
	ErrCodexCloudSignIn = problem.New("SESS_020", http.StatusBadGateway, "Codex on this host is not signed in to ChatGPT")
	// ErrNotReady refuses a message for an agent that is not up yet: no
	// status report and no screen the classifier can read, which is what a
	// trust or login dialog the person must answer looks like.
	ErrNotReady = problem.New("SESS_012", http.StatusConflict, "The session's agent is not ready for a message")
	// ErrShare refuses a file an agent asked to show the person
	// (`runner sessions send-file`): not there, not a regular file, or not
	// readable by the runner.
	ErrShare = problem.New("SESS_013", http.StatusBadRequest, "The file cannot be shared")
	// ErrNotify refuses `runner sessions notify` on a runner with no link to
	// the control plane: a host that is not paired has nobody to tell.
	ErrNotify = problem.New("SESS_014", http.StatusServiceUnavailable, "The person cannot be notified from this host")
	// ErrNoLink refuses what only the control plane can do for a session
	// (watch a pull request, wake it later) on a runner with no link to it.
	ErrNoLink = problem.New("SESS_015", http.StatusServiceUnavailable, "This host has no link to the control plane")
	// ErrSharedFileNotFound answers a preview asked for a file the session's
	// agent never shared on this host, or whose entry the session's clean-up
	// already took.
	ErrSharedFileNotFound = problem.New("SESS_016", http.StatusNotFound, "The session has no shared file by that id")
	// ErrSharedFileNoPreview answers a preview asked for a shared file the
	// runner kept none of: not an image, or too large to read when shared.
	ErrSharedFileNoPreview = problem.New("SESS_017", http.StatusConflict, "The shared file has no preview")
	// ErrNoTranscript answers a page of a session's conversation
	// (`transcript.read`) for an agent that keeps none in a file this runner
	// reads: OpenCode, which serves its conversation through its own API, or
	// a session with no conversation to find its file by.
	ErrNoTranscript = problem.New("SESS_018", http.StatusConflict, "The session's agent keeps no transcript this host can read")
	// ErrInvalidPattern refuses a terminal watch whose pattern is empty, too
	// long or not an RE2 expression. The code is the protocol's
	// (`session.watch`), not a SESS_ number: the control plane names it.
	ErrInvalidPattern = problem.New("INVALID_PATTERN", http.StatusBadRequest, "The watch pattern is not a valid expression")
	// ErrNotTerminal refuses `terminal.drive` on a session whose window 0 runs
	// an agent rather than a blank terminal: a bot types into a shell it
	// drives, never into an agent's prompt. The code is the protocol's.
	ErrNotTerminal = problem.New("EXEC_007", http.StatusConflict, "The session is not a blank terminal")
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
