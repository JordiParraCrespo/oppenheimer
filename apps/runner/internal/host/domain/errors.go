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
)
