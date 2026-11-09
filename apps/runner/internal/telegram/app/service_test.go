package app

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

const token = "7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"

// fakeAPI is the Bot API: updates queued by the test, sends recorded.
type fakeAPI struct {
	mu       sync.Mutex
	bots     map[string]domain.Bot
	updates  chan []Update
	pollErr  error
	sendErr  error
	sent     []string
	offsets  []int64
	webhooks int
}

func newFakeAPI() *fakeAPI {
	return &fakeAPI{
		bots:    map[string]domain.Bot{token: {ID: "7012345678", Username: "shop_bot", Name: "Shop"}},
		updates: make(chan []Update, 8),
	}
}

func (f *fakeAPI) GetMe(_ context.Context, tok string) (domain.Bot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	bot, ok := f.bots[tok]
	if !ok {
		return domain.Bot{}, domain.ErrUnauthorized
	}
	return bot, nil
}

func (f *fakeAPI) DeleteWebhook(context.Context, string) error {
	f.mu.Lock()
	f.webhooks++
	f.mu.Unlock()
	return nil
}

func (f *fakeAPI) GetUpdates(ctx context.Context, _ string, offset int64, wait time.Duration) ([]Update, error) {
	f.mu.Lock()
	f.offsets = append(f.offsets, offset)
	err := f.pollErr
	f.mu.Unlock()
	if err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case u := <-f.updates:
		return u, nil
	case <-time.After(wait):
		return nil, nil
	}
}

func (f *fakeAPI) SendMessage(_ context.Context, _, chatID, text, _ string) (string, time.Time, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.sendErr != nil {
		return "", time.Time{}, f.sendErr
	}
	f.sent = append(f.sent, chatID+":"+text)
	return "43", time.Unix(1_800_000_000, 0), nil
}

// memStore is the Store in memory.
type memStore struct {
	mu         sync.Mutex
	held       Held
	messages   []domain.Inbound
	advanceErr error
}

func (m *memStore) Load(context.Context) (Held, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.held, nil
}

func (m *memStore) Hold(_ context.Context, tok string, bot domain.Bot) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.held.Bot.ID != bot.ID {
		m.held.Offset, m.messages = 0, nil
	}
	m.held.Token, m.held.Bot = tok, bot
	return nil
}

func (m *memStore) Advance(_ context.Context, offset int64, messages []domain.Inbound) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.advanceErr != nil {
		return m.advanceErr
	}
	m.held.Offset = offset
	m.messages = append(m.messages, messages...)
	return nil
}

func (m *memStore) Pending(_ context.Context, limit int) ([]domain.Inbound, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]domain.Inbound(nil), m.messages[:min(limit, len(m.messages))]...), nil
}

func (m *memStore) Ack(_ context.Context, keys []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	drop := map[string]bool{}
	for _, k := range keys {
		drop[k] = true
	}
	kept := m.messages[:0]
	for _, msg := range m.messages {
		if !drop[msg.Key] {
			kept = append(kept, msg)
		}
	}
	m.messages = kept
	return nil
}

func (m *memStore) Forget(context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.held, m.messages = Held{}, nil
	return nil
}

// recorder is the link.
type recorder struct {
	mu       sync.Mutex
	states   []domain.Status
	batches  [][]domain.Inbound
	refusing bool
}

func (r *recorder) State(s domain.Status) {
	r.mu.Lock()
	r.states = append(r.states, s)
	r.mu.Unlock()
}

func (r *recorder) Messages(batch []domain.Inbound) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.refusing {
		return false
	}
	r.batches = append(r.batches, batch)
	return true
}

func (r *recorder) last() domain.Status {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.states) == 0 {
		return domain.Status{}
	}
	return r.states[len(r.states)-1]
}

func (r *recorder) delivered() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, b := range r.batches {
		n += len(b)
	}
	return n
}

func newService(t *testing.T, api *fakeAPI, store *memStore) (*Service, *recorder) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	svc := New(Options{
		API: api, Store: store, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		PollWait: 10 * time.Millisecond,
		Sleep:    func(ctx context.Context, _ time.Duration) { _ = ctx },
	})
	rec := &recorder{}
	svc.SetPublisher(rec)
	if err := svc.Start(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { svc.stopPolling(); cancel() })
	return svc, rec
}

func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatalf("never: %s", what)
}

func codeOf(err error) string {
	if pe := problem.From(err); pe != nil {
		return pe.Code
	}
	return ""
}

func update(id int64, text string) Update {
	return Update{
		UpdateID: id, IsMessage: true, ID: "1" + text, ChatID: "123", ChatType: domain.TypePrivate,
		SenderID: "123", SenderName: "Marta", Text: text, SentAt: time.Now(),
	}
}

// Connecting a bot keeps its token, deletes its webhook and polls: what
// people write reaches the link, and the offset moves past it only once it
// is kept, so the next poll asks for what comes after.
func TestLinkPollsAndHandsOnMessages(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	svc, rec := newService(t, api, store)
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	if got := rec.last().Bot.Username; got != "shop_bot" {
		t.Fatalf("bot %q", got)
	}
	api.updates <- []Update{update(5, "a"), update(6, "b")}
	eventually(t, "two messages delivered", func() bool { return rec.delivered() == 2 })
	eventually(t, "polled past them", func() bool {
		api.mu.Lock()
		defer api.mu.Unlock()
		return api.offsets[len(api.offsets)-1] == 7
	})
	if store.held.Token != token || api.webhooks != 1 {
		t.Fatalf("token kept %v, webhooks deleted %d", store.held.Token == token, api.webhooks)
	}
}

// A token Telegram refuses is TG_001 and nothing is kept; a second bot on a
// host that holds one is TG_002, since one host polls one bot.
func TestLinkRefusals(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	svc, rec := newService(t, api, store)
	if err := svc.Link(context.Background(), "1:bad-token-bad-token-bad"); codeOf(err) != "TG_001" {
		t.Fatalf("bad token: %v", err)
	}
	if store.held.Token != "" {
		t.Fatal("a refused token was kept")
	}
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	other := "8012345678:BBHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
	api.mu.Lock()
	api.bots[other] = domain.Bot{ID: "8012345678", Username: "other_bot"}
	api.mu.Unlock()
	if err := svc.Link(context.Background(), other); codeOf(err) != "TG_002" {
		t.Fatalf("second bot: %v", err)
	}
}

// A 401 while polling is a revoked token: the account says so and polling
// stops, rather than hammering Telegram with a dead token.
func TestRevokedTokenStopsPolling(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	svc, rec := newService(t, api, store)
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	api.mu.Lock()
	api.pollErr = domain.ErrUnauthorized
	api.mu.Unlock()
	eventually(t, "revoked", func() bool { return rec.last().State == domain.StateRevoked })
	api.mu.Lock()
	polls := len(api.offsets)
	api.mu.Unlock()
	time.Sleep(30 * time.Millisecond)
	api.mu.Lock()
	defer api.mu.Unlock()
	if len(api.offsets) != polls {
		t.Fatal("a revoked token was polled again")
	}
	_ = svc
}

// Disconnecting stops polling and forgets the token and what waited, so
// nothing of the old bot reaches the control plane after.
func TestUnlinkForgetsEverything(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	svc, rec := newService(t, api, store)
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	rec.mu.Lock()
	rec.refusing = true
	rec.mu.Unlock()
	api.updates <- []Update{update(5, "a")}
	eventually(t, "kept", func() bool { p, _ := store.Pending(context.Background(), 10); return len(p) == 1 })
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	if rec.last().State != domain.StateUnlinked || store.held.Token != "" || len(store.messages) != 0 {
		t.Fatalf("after unlink: %+v, token kept %v, %d waiting", rec.last(), store.held.Token != "", len(store.messages))
	}
}

// A batch the store could not keep leaves the offset where it was, so the
// same updates are asked for again rather than skipped.
func TestUnkeptUpdatesAreAskedAgain(t *testing.T) {
	api, store := newFakeAPI(), &memStore{advanceErr: errors.New("disk full")}
	svc, rec := newService(t, api, store)
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	api.updates <- []Update{update(5, "a")}
	eventually(t, "polled again from the same offset", func() bool {
		api.mu.Lock()
		defer api.mu.Unlock()
		zeros := 0
		for _, o := range api.offsets {
			if o == 0 {
				zeros++
			}
		}
		return zeros >= 3
	})
	if store.held.Offset != 0 {
		t.Fatalf("offset moved to %d", store.held.Offset)
	}
}

// Nothing is sent without a connected bot (TG_003); a 429 is TG_004 and
// holds every later send for its retry_after.
func TestSendRefusals(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	svc, rec := newService(t, api, store)
	if _, _, err := svc.Send(context.Background(), "123", "hi", ""); codeOf(err) != "TG_003" {
		t.Fatalf("not connected: %v", err)
	}
	if err := svc.Link(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	eventually(t, "connected", func() bool { return rec.last().State == domain.StateConnected })
	if id, _, err := svc.Send(context.Background(), "123", "hi", ""); err != nil || id != "43" {
		t.Fatalf("send: %q %v", id, err)
	}
	api.mu.Lock()
	api.sendErr = &domain.RetryAfter{After: time.Minute}
	api.mu.Unlock()
	if _, _, err := svc.Send(context.Background(), "456", "hi", ""); codeOf(err) != "TG_004" {
		t.Fatalf("429: %v", err)
	}
	api.mu.Lock()
	api.sendErr = nil
	api.mu.Unlock()
	if _, _, err := svc.Send(context.Background(), "789", "hi", ""); codeOf(err) != "TG_004" {
		t.Fatalf("during the pause: %v", err)
	}
}

// A host restarting with a held bot polls from its stored offset, and a new
// link is handed what waits unacked; an ack forgets it.
func TestRestartResumesAndAckForgets(t *testing.T) {
	api := newFakeAPI()
	store := &memStore{
		held:     Held{Token: token, Bot: domain.Bot{ID: "7012345678"}, Offset: 9},
		messages: []domain.Inbound{{Key: "123/1", ID: "1", ChatID: "123", ChatKind: domain.ChatDirect, SenderID: "123", Text: "x"}},
	}
	svc, rec := newService(t, api, store)
	eventually(t, "polled from the stored offset", func() bool {
		api.mu.Lock()
		defer api.mu.Unlock()
		return len(api.offsets) > 0 && api.offsets[0] == 9
	})
	svc.LinkUp(context.Background())
	eventually(t, "waiting message delivered", func() bool { return rec.delivered() == 1 })
	svc.Ack(context.Background(), []string{"123/1"})
	if p, _ := store.Pending(context.Background(), 10); len(p) != 0 {
		t.Fatal("an acked message still waits")
	}
}
