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
	// VoiceNotes keeps the voice notes the control plane may ask for; nil
	// keeps none, and every ask is WA_005.
	VoiceNotes VoiceNotes
	// Images keeps the images the control plane may ask for; nil keeps none,
	// and every ask is WA_005.
	Images Images
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
	voices VoiceNotes
	images Images
	logger *slog.Logger
	budget *domain.Budget
	now    func() time.Time

	mu        sync.Mutex
	opened    bool
	status    domain.Status
	pairing   bool
	pairedAt  time.Time
	publisher Publisher
	// chats is the device's last list of chats, handed to every new link.
	chats []domain.KnownChat
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
		device: opts.Device, outbox: opts.Outbox, voices: opts.VoiceNotes, images: opts.Images, logger: logger, budget: budget, now: now,
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
	s.publishChats()
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
	// What the number received and the control plane has not acked belongs to
	// the number being unlinked: kept, it would reach whichever number is
	// linked on this host next.
	if err := s.outbox.Clear(ctx); err != nil {
		s.logger.Warn("whatsapp: the outbox could not be emptied", slog.Any("error", err))
	}
	if s.voices != nil {
		if err := s.voices.ClearVoiceNotes(ctx); err != nil {
			s.logger.Warn("whatsapp: the kept voice notes could not be forgotten", slog.Any("error", err))
		}
	}
	if s.images != nil {
		if err := s.images.ClearImages(ctx); err != nil {
			s.logger.Warn("whatsapp: the kept images could not be forgotten", slog.Any("error", err))
		}
	}
	s.mu.Lock()
	s.inFlight = map[string]time.Time{}
	s.chats = nil
	s.mu.Unlock()
	s.set(domain.Status{State: domain.StateUnlinked, Reason: "unlinked from Oppenheimer"})
	return nil
}

// Send sends a text message as the paired number, inside the host's budget,
// quoting the message it replies to when there is one. A quoted reply spends
// the budget exactly as a plain message does.
func (s *Service) Send(ctx context.Context, chatID, text string, quote *domain.Quote) (string, time.Time, error) {
	return s.spend(func() (string, time.Time, error) { return s.device.Send(ctx, chatID, text, quote) })
}

// SendVoice sends a voice note as the paired number, inside the same budget
// a text spends: one note is one message to WhatsApp. Audio that is not a
// voice note WhatsApp plays is refused before it spends anything (WA_006,
// WA_008); an upload or a send WhatsApp refuses is WA_003, as a text's is.
func (s *Service) SendVoice(ctx context.Context, chatID string, audio []byte, seconds int) (string, time.Time, error) {
	if s.Status().State != domain.StateConnected {
		return "", time.Time{}, domain.ErrNotConnected
	}
	if err := domain.CheckVoiceOut(audio, seconds); err != nil {
		return "", time.Time{}, err
	}
	return s.spend(func() (string, time.Time, error) { return s.device.SendVoice(ctx, chatID, audio, seconds) })
}

// spend runs one send inside the host's budget: refused while the device is
// not connected or the budget is spent, refunded when WhatsApp refuses it,
// and pausing every send after WhatsApp's 429.
func (s *Service) spend(send func() (string, time.Time, error)) (string, time.Time, error) {
	if s.Status().State != domain.StateConnected {
		return "", time.Time{}, domain.ErrNotConnected
	}
	at := s.now()
	if !s.budget.Take(at) {
		return "", time.Time{}, domain.ErrBudgetExceeded.WithDetail(
			"at most %d a minute and %d a day", domain.SendsPerMinute, domain.SendsPerDay)
	}
	id, sentAt, err := send()
	if err != nil {
		s.budget.Refund(at)
		if errors.Is(err, domain.ErrRateLimited) {
			s.budget.PauseUntil(s.now().Add(domain.RateLimitPause))
		}
		return "", time.Time{}, domain.ErrSendRefused.WithDetail("%v", err)
	}
	return id, sentAt.UTC(), nil
}

// VoiceNote fetches a voice note the number received, for the control plane
// to transcribe: one it still keeps (domain.VoiceNoteKept), no larger than a
// frame carries. Fetching spends no send budget: it is a download from
// WhatsApp's media servers, which the phone itself makes for every note.
func (s *Service) VoiceNote(ctx context.Context, chatID, id string) ([]byte, string, error) {
	if s.Status().State != domain.StateConnected {
		return nil, "", domain.ErrNotConnected
	}
	if s.voices == nil {
		return nil, "", domain.ErrNoVoiceNote
	}
	voice, ok, err := s.voices.Find(ctx, chatID, id)
	if err != nil {
		return nil, "", domain.ErrNoVoiceNote.WithDetail("the kept voice notes could not be read: %v", err)
	}
	if !ok {
		return nil, "", domain.ErrNoVoiceNote.WithDetail("none kept for %s; they are kept %s", id, domain.VoiceNoteKept)
	}
	if voice.TooLarge() {
		return nil, "", domain.ErrVoiceTooLarge.WithDetail("%d bytes, at most %d", voice.Size, domain.VoiceNoteMaxBytes)
	}
	data, mimetype, err := s.device.Download(ctx, voice.Ref)
	if err != nil {
		return nil, "", domain.ErrVoiceDownload.WithDetail("%v", err)
	}
	if len(data) > domain.VoiceNoteMaxBytes {
		return nil, "", domain.ErrVoiceTooLarge.WithDetail("%d bytes, at most %d", len(data), domain.VoiceNoteMaxBytes)
	}
	return data, mimetype, nil
}

// Image fetches an image the number received, for a bot to see: one it
// still keeps (domain.VoiceNoteKept), scaled down when it is larger than a
// frame carries (domain.FitImage). Like a voice note, fetching spends no
// send budget.
func (s *Service) Image(ctx context.Context, chatID, id string) ([]byte, string, error) {
	if s.Status().State != domain.StateConnected {
		return nil, "", domain.ErrNotConnected
	}
	if s.images == nil {
		return nil, "", domain.ErrNoVoiceNote
	}
	image, ok, err := s.images.FindImage(ctx, chatID, id)
	if err != nil {
		return nil, "", domain.ErrNoVoiceNote.WithDetail("the kept images could not be read: %v", err)
	}
	if !ok {
		return nil, "", domain.ErrNoVoiceNote.WithDetail("no image kept for %s; they are kept %s", id, domain.VoiceNoteKept)
	}
	if image.TooLarge() {
		return nil, "", domain.ErrVoiceTooLarge.WithDetail("%d bytes, at most %d", image.Size, domain.ImageDownloadMaxBytes)
	}
	data, mimetype, err := s.device.DownloadImage(ctx, image.Ref, domain.ImageDownloadMaxBytes)
	if err != nil {
		return nil, "", domain.ErrVoiceDownload.WithDetail("%v", err)
	}
	fitted, mimetype, err := domain.FitImage(data, mimetype, domain.ImageMaxBytes)
	if err != nil {
		return nil, "", domain.ErrVoiceTooLarge.WithDetail("%d bytes: %v", len(data), err)
	}
	return fitted, mimetype, nil
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
// batches of BatchMax under domain.BatchMaxBytes, until the link refuses one.
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
	if r.Voice != nil && s.voices != nil {
		// Kept before the message goes out, so an ask for it never finds nothing.
		if err := s.voices.Keep(ctx, message.ChatID, message.ID, *r.Voice); err != nil {
			s.logger.Warn("whatsapp: a voice note could not be kept; bots will not hear it", slog.Any("error", err))
			message.VoiceSeconds = 0
		}
	}
	if r.Image != nil && s.images != nil {
		if err := s.images.KeepImage(ctx, message.ChatID, message.ID, *r.Image); err != nil {
			s.logger.Warn("whatsapp: an image could not be kept; bots will not see it", slog.Any("error", err))
		}
	}
	if err := s.outbox.Put(ctx, message); err != nil {
		s.logger.Error("whatsapp: a message could not be kept; it is lost", slog.Any("error", err))
		return
	}
	s.Flush(ctx)
}

// Chats keeps the device's chats and hands them to the link. A list lost to a
// link that is down goes with the next LinkUp.
func (s *Service) Chats(chats []domain.KnownChat) {
	s.mu.Lock()
	s.chats = chats
	s.mu.Unlock()
	s.publishChats()
}

func (s *Service) publishChats() {
	s.mu.Lock()
	publisher, chats := s.publisher, s.chats
	s.mu.Unlock()
	if publisher == nil {
		return
	}
	for _, batch := range domain.ChatBatches(chats) {
		publisher.Chats(batch)
	}
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
	s.mu.Lock()
	s.chats = nil
	s.mu.Unlock()
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
