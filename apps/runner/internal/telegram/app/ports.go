// Package app holds the host's Telegram bot: checking its token, polling the
// Bot API for what people write to it, handing the control plane every
// message that arrives and sending what the control plane asks
// (product/next-steps/telegram.md).
package app

import (
	"context"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// Update is one Bot API update, read into the domain's shape.
type Update = domain.Received

// BotAPI is Telegram's Bot API, over HTTPS. Every call takes the token, which
// the service holds and no adapter keeps. A 401 is domain.ErrUnauthorized, a
// 429 a *domain.RetryAfter, any other refusal a *domain.Refused; no error
// carries the token.
type BotAPI interface {
	// GetMe is the bot the token belongs to.
	GetMe(ctx context.Context, token string) (domain.Bot, error)
	// DeleteWebhook drops the bot's webhook, without which getUpdates is
	// refused, and keeps the updates waiting.
	DeleteWebhook(ctx context.Context, token string) error
	// GetUpdates long-polls for updates from offset on, waiting up to wait.
	GetUpdates(ctx context.Context, token string, offset int64, wait time.Duration) ([]Update, error)
	// SendMessage sends plain text to a chat, replying to replyToID when set;
	// the id and time are Telegram's.
	SendMessage(ctx context.Context, token, chatID, text, replyToID string) (id string, at time.Time, err error)
}

// Held is what the store keeps of the bot: its token and who it is.
type Held struct {
	// Token is empty when no bot is held.
	Token string
	Bot   domain.Bot
	// Offset is the next update to ask for.
	Offset int64
}

// Store keeps the bot's token, the poll's offset and the messages the
// control plane has not acknowledged, on disk, readable by the runner's user
// only, so neither a dropped link nor a restart loses one.
type Store interface {
	// Load reads what is held; an empty Held is no bot.
	Load(ctx context.Context) (Held, error)
	// Hold keeps a bot's token, starting its offset at zero for a new bot
	// and keeping it for the one already held.
	Hold(ctx context.Context, token string, bot domain.Bot) error
	// Advance keeps messages and moves the offset to offset, at once: an
	// update is never skipped without its message being kept.
	Advance(ctx context.Context, offset int64, messages []domain.Inbound) error
	// Pending is up to limit messages, oldest first.
	Pending(ctx context.Context, limit int) ([]domain.Inbound, error)
	// Ack forgets the messages under keys.
	Ack(ctx context.Context, keys []string) error
	// Forget deletes the token, the offset and every message waiting.
	Forget(ctx context.Context) error
}

// Publisher is the control-plane link, as the service reaches it.
type Publisher interface {
	// State tells the control plane how the bot stands.
	State(domain.Status)
	// Messages hands it a batch, and reports whether the link took it.
	Messages([]domain.Inbound) bool
}
