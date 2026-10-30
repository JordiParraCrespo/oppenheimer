package app

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

const (
	// BatchMax is how many messages one `whatsapp.messages` carries
	// (`WHATSAPP_BATCH_MAX_MESSAGES`).
	BatchMax = 50
	// pendingRead is how many waiting messages one flush reads.
	pendingRead = 500
	// ackTimeout is how long a batch the link took waits for its ack before
	// it is sent again; a new link sends everything unacked at once.
	ackTimeout = time.Minute
	// retryEvery is how often what waits is offered to the link again.
	retryEvery = 15 * time.Second
)

// Options are the service's dependencies.
type Options struct {
	Device Device
	Outbox Outbox
	Logger *slog.Logger
	// Budget is the host's own send limit; nil is domain.SendsPerMinute and
	// domain.SendsPerDay.
	Budget *domain.Budget
	// Now is the clock; nil is time.Now.
	Now func() time.Time
}

// Service is the host's one WhatsApp linked device.
type Service struct {
	device Device
	outbox Outbox
	logger *slog.Logger
	budget *domain.Budget
	now    func() time.Time

	mu        sync.Mutex
	opened    bool
	status    domain.Status
	pairing   bool
	pairedAt  time.Time
	publisher Publisher
	// inFlight is when each message was last handed to the link, until its
	// ack; a flush skips what was handed on less than ackTimeout ago.
	inFlight map[string]time.Time
	// flushing serialises flushes: messages arriving fast flush once.
	flushing sync.Mutex
}

// New builds the service; nothing is opened until Start.
func New(opts Options) *Service {
	budget := opts.Budget
	if budget == nil {
		budget = domain.NewBudget(domain.SendsPerMinute, domain.SendsPerDay)
	}
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Service{
		device: opts.Device, outbox: opts.Outbox, logger: logger, budget: budget, now: now,
		status: domain.Status{State: domain.StateUnlinked}, inFlight: map[string]time.Time{},
	}
}

// SetPublisher names the link the service reports to.
func (s *Service) SetPublisher(p Publisher) {
	s.mu.Lock()
	s.publisher = p
	s.mu.Unlock()
}

// Start opens the stored device and, when there is one, connects it, then
// keeps offering the link what waits for it until ctx ends.
func (s *Service) Start(ctx context.Context) error {
	paired, err := s.device.Open(ctx, s)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.opened = true
	if paired.Phone != "" {
		s.status = domain.Status{State: domain.StateConnecting, Phone: paired.Phone, Name: paired.Name}
	}
	s.mu.Unlock()
	if paired.Phone != "" {
		go func() {
			if err := s.device.Connect(ctx); err != nil {
				s.logger.Warn("whatsapp: the stored device did not connect; it keeps trying", slog.Any("error", err))
			}
		}()
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

// Status is how the device stands.
func (s *Service) Status() domain.Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

// LinkUp is a new control-plane link: it is told how the device stands, and
// handed every message still unacknowledged.
func (s *Service) LinkUp(ctx context.Context) {
	s.mu.Lock()
	s.inFlight = map[string]time.Time{}
	s.mu.Unlock()
	s.publish()
	s.Flush(ctx)
}

// Link pairs a new device: the codes go to the link as they come, and it
// returns once the phone scanned one or pairing ended. A host that holds a
// device refuses; a pairing already running carries on, and the link is told
// where it stands.
func (s *Service) Link(ctx context.Context) error {
	s.mu.Lock()
	switch {
	case !s.opened:
		s.mu.Unlock()
		return domain.ErrNotConnected.WithDetail("the WhatsApp store is not open on this host")
	case s.status.Phone != "":
		s.mu.Unlock()
		return domain.ErrAlreadyLinked.WithDetail("%s is linked; unlink it first", s.status.Phone)
	case s.pairing:
		s.mu.Unlock()
		s.publish()
		return nil
	}
	s.pairing = true
	s.mu.Unlock()

	paired, err := s.device.Pair(ctx, func(code string, expires time.Time) {
		s.set(domain.Status{State: domain.StatePairing, QR: code, QRExpiresAt: expires})
	})
	s.mu.Lock()
	s.pairing = false
	if err != nil {
		s.mu.Unlock()
		s.set(domain.Status{State: domain.StateUnlinked, Reason: domain.Fit(err.Error(), 200)})
		return nil
	}
	s.pairedAt = s.now()
	// Connected may already have landed; otherwise the device is paired and
	// on its way up, and a second link is refused from here on.
	if s.status.State == domain.StateConnected {
		s.mu.Unlock()
		return nil
	}
	s.mu.Unlock()
	s.set(domain.Status{State: domain.StateConnecting, Phone: paired.Phone, Name: paired.Name})
	return nil
}

// Unlink logs the device out and deletes its keys. A host with none answers
// the same.
func (s *Service) Unlink(ctx context.Context) error {
	if err := s.device.Logout(ctx); err != nil {
		s.logger.Warn("whatsapp: logging the device out failed; its keys are deleted anyway", slog.Any("error", err))
	}
	s.set(domain.Status{State: domain.StateUnlinked, Reason: "unlinked from Oppenheimer"})
	return nil
}

// Send sends a text message as the paired number, inside the host's budget.
func (s *Service) Send(ctx context.Context, chatID, text string) (string, time.Time, error) {
	if s.Status().State != domain.StateConnected {
		return "", time.Time{}, domain.ErrNotConnected
	}
	at := s.now()
	if !s.budget.Take(at) {
		return "", time.Time{}, domain.ErrBudgetExceeded.WithDetail(
			"at most %d a minute and %d a day", domain.SendsPerMinute, domain.SendsPerDay)
	}
	id, sentAt, err := s.device.Send(ctx, chatID, text)
	if err != nil {
		s.budget.Refund(at)
		if errors.Is(err, domain.ErrRateLimited) {
			s.budget.PauseUntil(s.now().Add(domain.RateLimitPause))
		}
		return "", time.Time{}, domain.ErrSendRefused.WithDetail("%v", err)
	}
	return id, sentAt.UTC(), nil
}

// Ack forgets what the control plane stored.
func (s *Service) Ack(ctx context.Context, keys []string) {
	if err := s.outbox.Ack(ctx, keys); err != nil {
		s.logger.Warn("whatsapp: an ack could not be recorded; those messages are sent again", slog.Any("error", err))
		return
	}
	s.mu.Lock()
	for _, key := range keys {
		delete(s.inFlight, key)
	}
	s.mu.Unlock()
}

// Flush offers the link everything waiting that it does not hold unacked, in
// batches of BatchMax, until the link refuses one.
func (s *Service) Flush(ctx context.Context) {
	s.flushing.Lock()
	defer s.flushing.Unlock()
	s.mu.Lock()
	publisher, opened := s.publisher, s.opened
	s.mu.Unlock()
	if publisher == nil || !opened {
		return
	}
	pending, err := s.outbox.Pending(ctx, pendingRead)
	if err != nil {
		s.logger.Warn("whatsapp: the outbox could not be read", slog.Any("error", err))
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
	for start := 0; start < len(due); start += BatchMax {
		batch := due[start:min(start+BatchMax, len(due))]
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

/* ---------------------------------------------------------------- Events */

// Received keeps a message the domain admits and offers it to the link.
func (s *Service) Received(r domain.Received) {
	s.mu.Lock()
	pairedAt := s.pairedAt
	s.mu.Unlock()
	message, ok := domain.Admit(r, s.now(), pairedAt)
	if !ok {
		return
	}
	ctx := context.Background()
	if err := s.outbox.Put(ctx, message); err != nil {
		s.logger.Error("whatsapp: a message could not be kept; it is lost", slog.Any("error", err))
		return
	}
	s.Flush(ctx)
}

// Connected is the device online.
func (s *Service) Connected(phone, name string) {
	s.set(domain.Status{State: domain.StateConnected, Phone: phone, Name: name})
}

// Disconnected is the device offline; it reconnects on its own.
func (s *Service) Disconnected() {
	s.mu.Lock()
	current := s.status
	s.mu.Unlock()
	if current.State != domain.StateConnected {
		return
	}
	current.State = domain.StateConnecting
	s.set(current)
}

// LoggedOut is the phone removing the device, or WhatsApp logging it out:
// its keys are gone, and it is not retried.
func (s *Service) LoggedOut(reason string) {
	s.set(domain.Status{State: domain.StateLoggedOut, Reason: domain.Fit(reason, 200)})
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
