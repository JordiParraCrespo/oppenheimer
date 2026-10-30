package app_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

var now = time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)

type fakeDevice struct {
	mu        sync.Mutex
	stored    app.Paired
	connected chan struct{}
	codes     []string
	pairErr   error
	sendErr   error
	sent      []string
	loggedOut bool
}

func (d *fakeDevice) Open(context.Context, app.Events) (app.Paired, error) { return d.stored, nil }
func (d *fakeDevice) Connect(context.Context) error {
	if d.connected != nil {
		close(d.connected)
	}
	return nil
}

func (d *fakeDevice) Pair(_ context.Context, onCode func(string, time.Time)) (app.Paired, error) {
	for _, code := range d.codes {
		onCode(code, now.Add(20*time.Second))
	}
	if d.pairErr != nil {
		return app.Paired{}, d.pairErr
	}
	return app.Paired{Phone: "34600111222@s.whatsapp.net", Name: "Jordi"}, nil
}

func (d *fakeDevice) Logout(context.Context) error { d.loggedOut = true; return nil }
func (d *fakeDevice) Send(_ context.Context, chatID, text string) (string, time.Time, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sendErr != nil {
		return "", time.Time{}, d.sendErr
	}
	d.sent = append(d.sent, chatID+": "+text)
	return fmt.Sprintf("ID%d", len(d.sent)), now, nil
}
func (d *fakeDevice) Close() {}

type memOutbox struct {
	mu   sync.Mutex
	rows []domain.Inbound
}

func (o *memOutbox) Put(_ context.Context, m domain.Inbound) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	for _, r := range o.rows {
		if r.Key == m.Key {
			return nil
		}
	}
	o.rows = append(o.rows, m)
	return nil
}

func (o *memOutbox) Pending(_ context.Context, limit int) ([]domain.Inbound, error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	return append([]domain.Inbound(nil), o.rows[:min(limit, len(o.rows))]...), nil
}

func (o *memOutbox) Ack(_ context.Context, keys []string) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	kept := o.rows[:0]
	for _, r := range o.rows {
		acked := false
		for _, k := range keys {
			acked = acked || k == r.Key
		}
		if !acked {
			kept = append(kept, r)
		}
	}
	o.rows = kept
	return nil
}

type recorder struct {
	mu      sync.Mutex
	states  []domain.Status
	batches [][]domain.Inbound
	refuse  bool
}

func (r *recorder) State(s domain.Status) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.states = append(r.states, s)
}

func (r *recorder) Messages(batch []domain.Inbound) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.refuse {
		return false
	}
	r.batches = append(r.batches, append([]domain.Inbound(nil), batch...))
	return true
}

func (r *recorder) last() domain.Status {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.states[len(r.states)-1]
}

func (r *recorder) sentKeys() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var keys []string
	for _, b := range r.batches {
		for _, m := range b {
			keys = append(keys, m.Key)
		}
	}
	return keys
}

func started(t *testing.T, device *fakeDevice, budget *domain.Budget) (*app.Service, *memOutbox, *recorder) {
	t.Helper()
	outbox, pub := &memOutbox{}, &recorder{}
	svc := app.New(app.Options{
		Device: device, Outbox: outbox, Budget: budget, Now: func() time.Time { return now },
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	svc.SetPublisher(pub)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	if err := svc.Start(ctx); err != nil {
		t.Fatal(err)
	}
	return svc, outbox, pub
}

func message(id string) domain.Received {
	return domain.Received{
		Where: domain.WhereChat, ID: id, ChatID: "34600333444@s.whatsapp.net", ChatKind: domain.ChatDirect,
		SenderID: "34600333444@s.whatsapp.net", Text: "hola " + id, SentAt: now.Add(-time.Second),
	}
}

func codeOf(err error) string {
	if pe := problem.From(err); pe != nil {
		return pe.Code
	}
	return ""
}

// A stored device is connected when the daemon starts, and a link that
// comes up hears how it stands.
func TestStartConnectsAStoredDevice(t *testing.T) {
	device := &fakeDevice{stored: app.Paired{Phone: "34600111222@s.whatsapp.net"}, connected: make(chan struct{})}
	svc, _, pub := started(t, device, nil)
	select {
	case <-device.connected:
	case <-time.After(time.Second):
		t.Fatal("the stored device was not connected")
	}
	svc.LinkUp(context.Background())
	if got := pub.last(); got.State != domain.StateConnecting || got.Phone != "34600111222@s.whatsapp.net" {
		t.Fatalf("link up heard %+v", got)
	}
}

// Pairing hands every QR code to the link, then the paired number; a host
// that holds a device refuses a second pairing with WA_001.
func TestLinkPairsThenRefusesASecondDevice(t *testing.T) {
	device := &fakeDevice{codes: []string{"2@one", "2@two"}}
	svc, _, pub := started(t, device, nil)
	if err := svc.Link(context.Background()); err != nil {
		t.Fatal(err)
	}
	pub.mu.Lock()
	states := append([]domain.Status(nil), pub.states...)
	pub.mu.Unlock()
	if len(states) != 3 || states[0].QR != "2@one" || states[1].QR != "2@two" || states[0].State != domain.StatePairing {
		t.Fatalf("states %+v", states)
	}
	if states[2].State != domain.StateConnecting || states[2].Phone != "34600111222@s.whatsapp.net" {
		t.Fatalf("after the scan: %+v", states[2])
	}
	if err := svc.Link(context.Background()); codeOf(err) != "WA_001" {
		t.Fatalf("a second link answered %v", err)
	}
}

// A pairing that ends unscanned leaves the host unlinked, with the reason.
func TestLinkThatTimesOutIsUnlinked(t *testing.T) {
	svc, _, pub := started(t, &fakeDevice{codes: []string{"2@one"}, pairErr: errors.New("pairing ended: timeout")}, nil)
	if err := svc.Link(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := pub.last(); got.State != domain.StateUnlinked || got.Reason == "" {
		t.Fatalf("got %+v", got)
	}
}

// Nothing is sent without a connected device (WA_002), past the
// budget (WA_004), or after WhatsApp's own rate limit, which pauses
// every send (WA_003, then 004).
func TestSendRefusals(t *testing.T) {
	device := &fakeDevice{}
	svc, _, _ := started(t, device, domain.NewBudget(1, 10))
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi"); codeOf(err) != "WA_002" {
		t.Fatalf("send without a device: %v", err)
	}
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if id, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi"); err != nil || id != "ID1" {
		t.Fatalf("send: %q %v", id, err)
	}
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "again"); codeOf(err) != "WA_004" {
		t.Fatalf("send past the budget: %v", err)
	}

	limited := &fakeDevice{sendErr: fmt.Errorf("%w: 429", domain.ErrRateLimited)}
	svc, _, _ = started(t, limited, domain.NewBudget(5, 10))
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi"); codeOf(err) != "WA_003" {
		t.Fatalf("rate-limited send: %v", err)
	}
	limited.sendErr = nil
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi"); codeOf(err) != "WA_004" {
		t.Fatalf("send during WhatsApp's pause: %v", err)
	}
}

// A message is kept, then handed on; it is not sent again while its ack is
// due, it is on a new link, and an ack forgets it.
func TestReceivedIsKeptUntilAcked(t *testing.T) {
	svc, outbox, pub := started(t, &fakeDevice{}, nil)
	svc.Received(message("A"))
	svc.Flush(context.Background())
	if got := pub.sentKeys(); len(got) != 1 || got[0] != "34600333444@s.whatsapp.net/A" {
		t.Fatalf("sent %v", got)
	}
	svc.LinkUp(context.Background())
	if got := pub.sentKeys(); len(got) != 2 {
		t.Fatalf("a new link did not get the unacked message again: %v", got)
	}
	svc.Ack(context.Background(), []string{"34600333444@s.whatsapp.net/A"})
	if pending, _ := outbox.Pending(context.Background(), 10); len(pending) != 0 {
		t.Fatalf("an acked message is still kept: %v", pending)
	}
}

// What waits goes in batches the link carries, at most fifty each; a link
// that is down keeps them all.
func TestFlushBatchesAtFifty(t *testing.T) {
	svc, outbox, pub := started(t, &fakeDevice{}, nil)
	pub.refuse = true
	for i := range 120 {
		svc.Received(message(fmt.Sprintf("M%03d", i)))
	}
	if pending, _ := outbox.Pending(context.Background(), 500); len(pending) != 120 {
		t.Fatalf("kept %d of 120", len(pending))
	}
	pub.refuse = false
	svc.LinkUp(context.Background())
	pub.mu.Lock()
	defer pub.mu.Unlock()
	if len(pub.batches) != 3 || len(pub.batches[0]) != app.BatchMax || len(pub.batches[2]) != 20 {
		t.Fatalf("batches of %d", len(pub.batches))
	}
}

// Unlinking logs the device out and says the host is unlinked.
func TestUnlink(t *testing.T) {
	device := &fakeDevice{}
	svc, _, pub := started(t, device, nil)
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !device.loggedOut || pub.last().State != domain.StateUnlinked {
		t.Fatalf("logged out %v, state %+v", device.loggedOut, pub.last())
	}
}
