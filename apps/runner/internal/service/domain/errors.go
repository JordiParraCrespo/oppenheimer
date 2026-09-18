package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrNoManager      = problem.New("SVC_001", http.StatusBadRequest, "No service manager for this platform")
	ErrInstallFailed  = problem.New("SVC_002", http.StatusInternalServerError, "The runner service could not be installed")
	ErrNotInstalled   = problem.New("SVC_003", http.StatusNotFound, "The runner service is not installed")
	ErrControlFailed  = problem.New("SVC_004", http.StatusInternalServerError, "The service manager refused the command")
	ErrLingerDisabled = problem.New("SVC_005", http.StatusFailedDependency, "The user service will not survive logout")
)
