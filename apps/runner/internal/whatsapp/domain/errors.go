package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
// The control plane reads the codes off `command.failed`, so they are part of
// the link's contract (packages/shared/src/protocol/whatsapp.ts).
var (
	ErrAlreadyLinked  = problem.New("WA_001", http.StatusConflict, "This host already holds a WhatsApp device")
	ErrNotConnected   = problem.New("WA_002", http.StatusServiceUnavailable, "No WhatsApp device is connected on this host")
	ErrSendRefused    = problem.New("WA_003", http.StatusBadGateway, "WhatsApp refused the message")
	ErrBudgetExceeded = problem.New("WA_004", http.StatusTooManyRequests, "This host's WhatsApp send budget is spent")
	ErrNoMedia        = problem.New("WA_005", http.StatusNotFound, "This host knows no such WhatsApp voice note or image")
	ErrMediaTooLarge  = problem.New("WA_006", http.StatusRequestEntityTooLarge, "The WhatsApp voice note or image is too large to hand over")
	ErrMediaDownload  = problem.New("WA_007", http.StatusBadGateway, "WhatsApp would not hand over the voice note or image")
)
