package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrNotRegistered     = problem.New("PAIR_001", http.StatusPreconditionRequired, "This host is not paired yet")
	ErrAlreadyRegisted   = problem.New("PAIR_002", http.StatusConflict, "This host is already paired")
	ErrTokenRejected     = problem.New("PAIR_003", http.StatusUnauthorized, "The registration token was rejected")
	ErrKeyStore          = problem.New("PAIR_004", http.StatusInternalServerError, "The host key could not be read or written")
	ErrControlPlaneURL   = problem.New("PAIR_005", http.StatusBadRequest, "The control plane URL is not usable")
	ErrUnreachable       = problem.New("PAIR_006", http.StatusBadGateway, "The control plane could not be reached")
	ErrRotationNeedsLink = problem.New("PAIR_007", http.StatusNotImplemented, "Key rotation needs the control-plane link")
)
