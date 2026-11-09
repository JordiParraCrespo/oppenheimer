package domain

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
// The control plane reads the codes off `command.failed`, so they are part of
// the link's contract (packages/shared/src/protocol/telegram.ts).
var (
	ErrTokenRefused = problem.New("TG_001", http.StatusBadRequest, "Telegram refused the bot's token")
	ErrAlreadyHeld  = problem.New("TG_002", http.StatusConflict, "This host already holds another Telegram bot")
	ErrNotConnected = problem.New("TG_003", http.StatusServiceUnavailable, "No Telegram bot is connected on this host")
	ErrSendRefused  = problem.New("TG_004", http.StatusBadGateway, "Telegram refused the message")
)

// ErrUnauthorized is Telegram answering 401: the token was revoked in
// @BotFather, or never was one. Polling stops on it.
var ErrUnauthorized = errors.New("telegram refused the token")

// RetryAfter is Telegram answering 429: nothing more is sent for After.
type RetryAfter struct{ After time.Duration }

func (e *RetryAfter) Error() string {
	return fmt.Sprintf("telegram asks to wait %s", e.After)
}

// Refused is any other answer Telegram gave with ok false: the person
// blocked the bot, the bot left the group, a chat it never had.
type Refused struct {
	Code        int
	Description string
}

func (e *Refused) Error() string {
	return fmt.Sprintf("telegram answered %d: %s", e.Code, e.Description)
}
