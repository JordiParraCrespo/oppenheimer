package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrManifest     = problem.New("UPD_001", http.StatusBadGateway, "The release manifest could not be verified")
	ErrArtifact     = problem.New("UPD_002", http.StatusBadGateway, "The release artifact could not be verified")
	ErrNoTarget     = problem.New("UPD_003", http.StatusNotFound, "No release exists for this platform")
	ErrBlocked      = problem.New("UPD_004", http.StatusConflict, "This host will not take that update")
	ErrSelfCheck    = problem.New("UPD_005", http.StatusInternalServerError, "The new binary failed its self-check")
	ErrActivate     = problem.New("UPD_006", http.StatusInternalServerError, "The new version could not be activated")
	ErrRolledBack   = problem.New("UPD_007", http.StatusInternalServerError, "The update was rolled back")
	ErrNoSigningKey = problem.New("UPD_008", http.StatusFailedDependency, "This build has no release key and cannot self-update")
)
