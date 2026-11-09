package app

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// poller long-polls getUpdates for one token until its context ends or
// Telegram refuses the token. It keeps the order that loses nothing: a
// batch's messages and the offset past it are stored together, and the
// offset never moves past an update that was not kept. What it learns about
// the bot it reports as domain events; what the bot's status becomes is
// Service's to decide.
type poller struct {
	api    BotAPI
	store  Store
	logger *slog.Logger
	now    func() time.Time
	sleep  func(ctx context.Context, d time.Duration)
	wait   time.Duration
	token  string
	// report hands each event to the service; kept is called after new
	// messages reach the outbox.
	report func(domain.Event)
	kept   func(ctx context.Context)
}

// run polls until ctx ends or the token is refused. fresh drops updates
// older than domain.MaxAge until the backlog is drained, which the first poll
// that comes back empty says: a bot new to this host can bring a day of
// updates, more than one page of them. Live messages are never that old, so
// the filter costs nothing while it lasts, and a batch that could not be
// kept is asked for again under the same rule.
func (p *poller) run(ctx context.Context, fresh bool) {
	backoff := BackoffMin
	for ctx.Err() == nil {
		held, err := p.store.Load(ctx)
		if err != nil {
			p.logger.Warn("telegram: the offset could not be read", slog.Any("error", err))
			p.sleep(ctx, backoff)
			backoff = min(backoff*2, BackoffMax)
			continue
		}
		updates, err := p.api.GetUpdates(ctx, p.token, held.Offset, p.wait)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			if errors.Is(err, domain.ErrUnauthorized) {
				p.report(domain.TokenRefused)
				return
			}
			wait := backoff
			var retry *domain.RetryAfter
			if errors.As(err, &retry) && retry.After > wait {
				wait = retry.After
			}
			p.logger.Warn("telegram: polling failed; trying again", slog.Any("error", err), slog.Duration("in", wait))
			p.report(domain.PollFailed)
			p.sleep(ctx, wait)
			backoff = min(backoff*2, BackoffMax)
			continue
		}
		backoff = BackoffMin
		p.report(domain.Polled)
		if len(updates) == 0 {
			fresh = false
			continue
		}
		offset, kept := admit(updates, held.Offset, p.now(), fresh)
		if err := p.store.Advance(ctx, offset, kept); err != nil {
			// The offset did not move: the same updates come again.
			p.logger.Error("telegram: messages could not be kept; asking again", slog.Any("error", err))
			p.sleep(ctx, backoff)
			continue
		}
		if len(kept) > 0 {
			p.kept(ctx)
		}
	}
}

// admit is the offset past every update of a batch, and the messages of it
// the control plane is handed.
func admit(updates []domain.Received, offset int64, now time.Time, fresh bool) (int64, []domain.Inbound) {
	var kept []domain.Inbound
	for _, u := range updates {
		if u.UpdateID+1 > offset {
			offset = u.UpdateID + 1
		}
		if m, ok := domain.Admit(u, now, fresh); ok {
			kept = append(kept, m)
		}
	}
	return offset, kept
}
