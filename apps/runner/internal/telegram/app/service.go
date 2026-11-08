package app

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

const (
	// BatchMax is how many messages one `telegram.messages` carries
	// (`TELEGRAM_BATCH_MAX_MESSAGES`).
	BatchMax = 50
	// pendingRead is how many waiting messages one flush reads.
	pendingRead = 500
	// ackTimeout is how long a batch the link took waits for its ack before
	// it is sent again; a new link sends everything unacked at once.
	ackTimeout = time.Minute
	// retryEvery is how often what waits is offered to the link again.
	retryEvery = 15 * time.Second
	// PollWait is how long one getUpdates waits for an update.
	PollWait = 25 * time.Second
	// BackoffMin and BackoffMax bound the wait after a poll that failed.
	BackoffMin = 2 * time.Second
	BackoffMax = 30 * time.Second
)

// Options are the service's dependencies.
type Options struct {
	API    BotAPI
	Store  Store
	Logger *slog.Logger
	// Now is the clock; nil is time.Now.
	Now func() time.Time
	// Sleep waits d or until ctx ends; nil is a timer. Tests shorten it.
	Sleep func(ctx context.Context, d time.Duration)
	// PollWait overrides PollWait; zero is PollWait.
	PollWait time.Duration
}

// Service is the host's one Telegram bot.
type Service struct {
	api      BotAPI
	store    Store
	logger   *slog.Logger
	now      func() time.Time
	sleep    func(ctx context.Context, d time.Duration)
	pollWait time.Duration
	pacer    *domain.Pacer

	mu        sync.Mutex
	opened    bool
	life      context.Context
	status    domain.Status
	token     string
	publisher Publisher
	// stopPoll ends the running poller, and polling is closed when it has.
	stopPoll context.CancelFunc
	polling  chan struct{}
	// inFlight is when each message was last handed to the link, until its ack.
	inFlight map[string]time.Time
	flushing sync.Mutex
	// linking serialises link and unlink.
	linking sync.Mutex
}

// New builds the service; nothing is opened until Start.
func New(opts Options) *Service {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	sleep := opts.Sleep
	if sleep == nil {
		sleep = func(ctx context.Context, d time.Duration) {
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-ctx.Done():
			case <-t.C:
			}
		}
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	wait := opts.PollWait
	if wait == 0 {
		wait = PollWait
	}
	return &Service{
		api: opts.API, store: opts.Store, logger: logger, now: now, sleep: sleep, pollWait: wait,
		pacer: domain.NewPacer(), status: domain.Status{State: domain.StateUnlinked},
		inFlight: map[string]time.Time{},
	}
}

// SetPublisher names the link the service reports to.
func (s *Service) SetPublisher(p Publisher) {
	s.mu.Lock()
	s.publisher = p
	s.mu.Unlock()
}

// Start reads the held bot and, when there is one, polls for it from its
// stored offset, then keeps offering the link what waits until ctx ends.
func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	opened := s.opened
	s.mu.Unlock()
	if opened {
		return nil
	}
	held, err := s.store.Load(ctx)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.opened, s.life = true, ctx
	if held.Token != "" {
		s.token = held.Token
		s.status = domain.Status{State: domain.StateConnecting, Bot: held.Bot}
	}
	s.mu.Unlock()
	if held.Token != "" {
		s.startPoll(false)
	}
	go s.retry(ctx)
	return nil
}

func (s *Service) retry(ctx context.Context) {
	ticker := time.NewTicker(retryEvery)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.Flush(ctx)
		}
	}
}

// Status is how the bot stands.
func (s *Service) Status() domain.Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

// LinkUp is a new control-plane link: it is told how the bot stands, and
// handed every message still unacknowledged.
func (s *Service) LinkUp(ctx context.Context) {
	s.mu.Lock()
	s.inFlight = map[string]time.Time{}
	s.mu.Unlock()
	s.publish()
	s.Flush(ctx)
}

// Link connects a bot by its token: Telegram checks it, the host keeps it,
// the bot's webhook goes and polling starts. The bot already held takes a
// new token and carries on from its offset; another bot is refused.
func (s *Service) Link(ctx context.Context, token string) error {
	s.linking.Lock()
	defer s.linking.Unlock()
	s.mu.Lock()
	opened, held := s.opened, s.status
	s.mu.Unlock()
	if !opened {
		return domain.ErrNotConnected.WithDetail("the Telegram store is not open on this host")
	}
	bot, err := s.api.GetMe(ctx, token)
	if err != nil {
		if errors.Is(err, domain.ErrUnauthorized) {
			return domain.ErrTokenRefused.WithDetail("check the token @BotFather gave you")
		}
		var refused *domain.Refused
		if errors.As(err, &refused) {
			return domain.ErrTokenRefused.WithDetail("%s", domain.Fit(refused.Description, 200))
		}
		return domain.ErrTokenRefused.WithDetail("Telegram could not be reached: %v", err)
	}
	if held.State != domain.StateUnlinked && held.Bot.ID != "" && held.Bot.ID != bot.ID {
		return domain.ErrAlreadyHeld.WithDetail("@%s is connected; disconnect it first", held.Bot.Username)
	}
	if err := s.api.DeleteWebhook(ctx, token); err != nil {
		s.logger.Warn("telegram: the bot's webhook could not be deleted; polling may be refused", slog.Any("error", err))
	}
	if err := s.store.Hold(ctx, token, bot); err != nil {
		return domain.ErrNotConnected.WithDetail("the token could not be kept on this host: %v", err)
	}
	s.stopPolling()
	s.mu.Lock()
	s.token = token
	s.mu.Unlock()
	s.set(domain.Status{State: domain.StateConnecting, Bot: bot})
	s.startPoll(held.Bot.ID != bot.ID)
	return nil
}

// Unlink stops polling and forgets the token, the offset and what waits for
// the control plane. A host with no bot answers the same.
func (s *Service) Unlink(ctx context.Context) error {
	s.linking.Lock()
	defer s.linking.Unlock()
	s.stopPolling()
	if err := s.store.Forget(ctx); err != nil {
		s.logger.Warn("telegram: the held bot could not be forgotten", slog.Any("error", err))
	}
	s.mu.Lock()
	s.token = ""
	s.inFlight = map[string]time.Time{}
	s.mu.Unlock()
	s.set(domain.Status{State: domain.StateUnlinked, Reason: "disconnected from Oppenheimer"})
	return nil
}

// Send sends a plain-text message as the bot, paced to Telegram's limits.
func (s *Service) Send(ctx context.Context, chatID, text, replyToID string) (string, time.Time, error) {
	s.mu.Lock()
	state, token := s.status.State, s.token
	s.mu.Unlock()
	if state != domain.StateConnected || token == "" {
		return "", time.Time{}, domain.ErrNotConnected
	}
	wait, ok := s.pacer.Reserve(chatID, s.now())
	if !ok {
		return "", time.Time{}, domain.ErrSendRefused.WithDetail(
			"sending too fast for Telegram; try again in %s", wait.Round(time.Second))
	}
	if wait > 0 {
		s.sleep(ctx, wait)
		if ctx.Err() != nil {
			return "", time.Time{}, domain.ErrSendRefused.WithDetail("%v", ctx.Err())
		}
	}
	id, at, err := s.api.SendMessage(ctx, token, chatID, text, replyToID)
	if err != nil {
		var retry *domain.RetryAfter
		switch {
		case errors.As(err, &retry):
			s.pacer.PauseUntil(s.now().Add(retry.After))
		case errors.Is(err, domain.ErrUnauthorized):
			s.on(domain.TokenRefused)
		}
		return "", time.Time{}, domain.ErrSendRefused.WithDetail("%s", domain.Fit(err.Error(), 300))
	}
	return id, at.UTC(), nil
}

// Ack forgets what the control plane stored.
func (s *Service) Ack(ctx context.Context, keys []string) {
	if err := s.store.Ack(ctx, keys); err != nil {
		s.logger.Warn("telegram: an ack could not be recorded; those messages are sent again", slog.Any("error", err))
		return
	}
	s.mu.Lock()
	for _, key := range keys {
		delete(s.inFlight, key)
	}
	s.mu.Unlock()
}

// Flush offers the link everything waiting that it does not hold unacked, in
// batches, until the link refuses one.
func (s *Service) Flush(ctx context.Context) {
	s.flushing.Lock()
	defer s.flushing.Unlock()
	s.mu.Lock()
	publisher, opened := s.publisher, s.opened
	s.mu.Unlock()
	if publisher == nil || !opened {
		return
	}
	pending, err := s.store.Pending(ctx, pendingRead)
	if err != nil {
		s.logger.Warn("telegram: the outbox could not be read", slog.Any("error", err))
		return
	}
	now := s.now()
	s.mu.Lock()
	due := pending[:0]
	for _, m := range pending {
		if at, ok := s.inFlight[m.Key]; ok && now.Sub(at) < ackTimeout {
			continue
		}
		due = append(due, m)
	}
	s.mu.Unlock()
	for _, batch := range domain.Batches(due, BatchMax, domain.BatchMaxBytes) {
		if !publisher.Messages(batch) {
			return
		}
		s.mu.Lock()
		for _, m := range batch {
			s.inFlight[m.Key] = now
		}
		s.mu.Unlock()
	}
}

/* ---------------------------------------------------------------- polling */

// startPoll runs a poller for the held token until stopPolling. fresh drops
// a backlog older than domain.MaxAge on its first poll: a bot new to this host.
func (s *Service) startPoll(fresh bool) {
	s.mu.Lock()
	life := s.life
	s.mu.Unlock()
	if life == nil {
		life = context.Background()
	}
	ctx, cancel := context.WithCancel(life)
	done := make(chan struct{})
	s.mu.Lock()
	s.stopPoll, s.polling = cancel, done
	p := &poller{
		api: s.api, store: s.store, logger: s.logger, now: s.now, sleep: s.sleep,
		wait: s.pollWait, token: s.token, report: s.on, kept: s.Flush,
	}
	s.mu.Unlock()
	go func() {
		defer close(done)
		p.run(ctx, fresh)
	}()
}

// stopPolling ends the running poller, if any, and waits for it.
func (s *Service) stopPolling() {
	s.mu.Lock()
	stop, done := s.stopPoll, s.polling
	s.stopPoll, s.polling = nil, nil
	s.mu.Unlock()
	if stop != nil {
		stop()
		<-done
	}
}

// on folds what the poller learned into the bot's status, and reports it
// when it changed (domain.Status.On).
func (s *Service) on(e domain.Event) {
	s.mu.Lock()
	next, changed := s.status.On(e)
	s.status = next
	s.mu.Unlock()
	if changed {
		s.publish()
	}
}

func (s *Service) set(status domain.Status) {
	s.mu.Lock()
	s.status = status
	s.mu.Unlock()
	s.publish()
}

func (s *Service) publish() {
	s.mu.Lock()
	publisher, status := s.publisher, s.status
	s.mu.Unlock()
	if publisher != nil {
		publisher.State(status)
	}
}
