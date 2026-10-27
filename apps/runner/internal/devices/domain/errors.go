package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrNoDevice    = problem.New("DEV_001", http.StatusConflict, "This host has no device for the session")
	ErrUnreachable = problem.New("DEV_002", http.StatusBadGateway, "The session's device could not be reached")
	ErrInput       = problem.New("DEV_003", http.StatusBadRequest, "The device does not take that input")
)
