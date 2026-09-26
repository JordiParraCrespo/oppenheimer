package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrKeyNotFound     = problem.New("APIKEY_001", http.StatusNotFound, "API key not found")
	ErrAlreadyRevoked  = problem.New("APIKEY_002", http.StatusConflict, "API key already revoked")
	ErrScopeEscalation = problem.New("APIKEY_003", http.StatusForbidden, "Cannot grant scopes you do not hold")
	ErrTokensDisabled  = problem.New("APIKEY_004", http.StatusNotImplemented, "Service tokens are not enabled")
)
