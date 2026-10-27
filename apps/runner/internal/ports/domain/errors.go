package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrNotListening = problem.New("PORT_001", http.StatusNotFound, "The session does not listen on that port")
	ErrUnreachable  = problem.New("PORT_002", http.StatusBadGateway, "Nothing answers on that port")
	ErrUnsupported  = problem.New("PORT_003", http.StatusNotImplemented, "This host cannot list a session's ports")
)
