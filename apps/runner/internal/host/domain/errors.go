package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrPlatformUnsupported = problem.New("HOST_001", http.StatusBadRequest, "Host platform is not supported")
	ErrRoot                = problem.New("HOST_002", http.StatusBadRequest, "The runner must not run as root")
	ErrPreflight           = problem.New("HOST_003", http.StatusFailedDependency, "A tool the runner needs is missing")
	ErrDiskPressure        = problem.New("HOST_004", http.StatusInsufficientStorage, "Free disk is below the floor")
	ErrProbe               = problem.New("HOST_005", http.StatusInternalServerError, "Could not inspect the host")
	ErrEphemeral           = problem.New("HOST_006", http.StatusPreconditionFailed, "This machine looks temporary")
	ErrWorkspaces          = problem.New("HOST_007", http.StatusBadRequest, "The workspaces directory is not usable")
	ErrRunnerDirectory     = problem.New("HOST_008", http.StatusPreconditionFailed, "The runner's own directory is not safe to use")
	ErrAgentUpdate         = problem.New("HOST_009", http.StatusFailedDependency, "An agent CLI could not be updated")
	ErrInstallUnsupported  = problem.New("HOST_010", http.StatusBadRequest, "The runner does not install this tool")
	ErrInstallFailed       = problem.New("HOST_011", http.StatusFailedDependency, "A tool could not be installed")
	// ErrRunnerDown is a command that needs the running daemon (a session's
	// `runner sessions run|send|wait|report`) finding no one on its socket.
	ErrRunnerDown = problem.New("HOST_012", http.StatusServiceUnavailable, "The runner is not running on this host")
	// The folder picker's listing (`fs.list`, 24 §4). The codes are the
	// protocol's, named in packages/shared's fsListSchema.
	ErrFolderNotFound   = problem.New("FS_001", http.StatusNotFound, "The folder does not exist")
	ErrFolderNotDir     = problem.New("FS_002", http.StatusBadRequest, "The path is not a directory")
	ErrFolderUnreadable = problem.New("FS_003", http.StatusForbidden, "The folder cannot be read")
	// A bot's command on the host (`host.exec`, 25 §4.2). The codes are the
	// protocol's, named in packages/shared's hostExecSchema.
	ErrExecDisabled   = problem.New("EXEC_001", http.StatusForbidden, "Running commands is off on this host")
	ErrExecRefused    = problem.New("EXEC_002", http.StatusForbidden, "This host does not allow that program")
	ErrExecFolder     = problem.New("EXEC_003", http.StatusBadRequest, "The folder to run in is not usable")
	ErrExecStart      = problem.New("EXEC_004", http.StatusFailedDependency, "The program could not be started")
	ErrExecPolicyFile = problem.New("EXEC_005", http.StatusInternalServerError, "The host's exec policy cannot be read")
	// A bot driving a terminal session (`terminal.drive`): a shell runs
	// anything, so only a host whose exec policy is full takes it.
	ErrTerminalNeedsFull = problem.New("EXEC_006", http.StatusForbidden, "This host does not let bots drive a terminal")
	// A bot using the host's screen, mouse and keyboard (`computer.act`,
	// 25 §4.2). The codes are the protocol's, named in packages/shared's
	// computerActSchema.
	ErrComputerOff        = problem.New("COMPUTER_001", http.StatusForbidden, "Using this host's screen is off")
	ErrComputerNoScreen   = problem.New("COMPUTER_002", http.StatusFailedDependency, "This host has no screen the runner can use")
	ErrComputerAction     = problem.New("COMPUTER_003", http.StatusBadRequest, "The action does not fit the screen")
	ErrComputerUnusable   = problem.New("COMPUTER_004", http.StatusFailedDependency, "The screen could not be read or used")
	ErrComputerPolicyFile = problem.New("COMPUTER_005", http.StatusInternalServerError, "The host's computer setting cannot be read")
	// A bot driving a browser of its own on the host (`browser.act`, 25
	// §4.2). The codes are the protocol's, named in packages/shared's
	// browserActSchema.
	ErrBrowserOff        = problem.New("BROWSER_001", http.StatusForbidden, "Browsers for bots are off on this host")
	ErrBrowserMissing    = problem.New("BROWSER_002", http.StatusFailedDependency, "This host has no browser the runner can start")
	ErrBrowserAction     = problem.New("BROWSER_003", http.StatusBadRequest, "The action does not fit the page")
	ErrBrowserFailed     = problem.New("BROWSER_004", http.StatusFailedDependency, "The browser or the page failed")
	ErrBrowserPolicyFile = problem.New("BROWSER_005", http.StatusInternalServerError, "The host's browser setting cannot be read")
)
