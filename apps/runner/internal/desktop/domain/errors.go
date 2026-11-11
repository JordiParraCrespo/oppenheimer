package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrOff          = problem.New("DESKTOP_001", http.StatusConflict, "This host does not share its desktop")
	ErrUnreachable  = problem.New("DESKTOP_002", http.StatusBadGateway, "No screen-sharing server answers on this host")
	ErrRefused      = problem.New("DESKTOP_003", http.StatusBadGateway, "The screen-sharing server refused this host's credentials")
	ErrUnsupported  = problem.New("DESKTOP_004", http.StatusBadGateway, "The screen-sharing server asks for a kind of sign-in the runner does not speak")
	ErrSettings     = problem.New("DESKTOP_005", http.StatusInternalServerError, "This host's desktop settings could not be read or written")
	ErrInvalidInput = problem.New("DESKTOP_006", http.StatusBadRequest, "That is not a valid desktop setting")
)
