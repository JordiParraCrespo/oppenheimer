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
	// audio is what Download hands back for any ref.
	audio []byte
	// image is what DownloadImage hands back for any ref.
	image []byte
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
func (d *fakeDevice) Send(_ context.Context, chatID, text string, quote *domain.Quote) (string, time.Time, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sendErr != nil {
		return "", time.Time{}, d.sendErr
	}
	if quote != nil {
		text = "> " + quote.ID + " " + text
	}
	d.sent = append(d.sent, chatID+": "+text)
	return fmt.Sprintf("ID%d", len(d.sent)), now, nil
}
func (d *fakeDevice) SendVoice(_ context.Context, chatID string, audio []byte, seconds int) (string, time.Time, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sendErr != nil {
		return "", time.Time{}, d.sendErr
	}
	d.sent = append(d.sent, fmt.Sprintf("%s: voice %ds %dB", chatID, seconds, len(audio)))
	return fmt.Sprintf("ID%d", len(d.sent)), now, nil
}
func (d *fakeDevice) Download(_ context.Context, ref []byte) ([]byte, string, error) {
	if string(ref) != "ref" {
		return nil, "", errors.New("unknown ref")
	}
	return d.audio, "audio/ogg; codecs=opus", nil
}
func (d *fakeDevice) DownloadImage(_ context.Context, ref []byte, max int) ([]byte, string, error) {
	if string(ref) != "ref" {
		return nil, "", errors.New("unknown ref")
	}
	if len(d.image) > max {
		return nil, "", errors.New("too large")
	}
	return d.image, "image/jpeg", nil
}
func (d *fakeDevice) Close() {}

type memImages struct {
	mu   sync.Mutex
	kept map[string]domain.Image
}

func (m *memImages) KeepImage(_ context.Context, chatID, id string, image domain.Image) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.kept == nil {
		m.kept = map[string]domain.Image{}
	}
	m.kept[domain.KeyOf(chatID, id)] = image
	return nil
}

func (m *memImages) FindImage(_ context.Context, chatID, id string) (domain.Image, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	image, ok := m.kept[domain.KeyOf(chatID, id)]
	return image, ok, nil
}

func (m *memImages) ClearImages(context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.kept = nil
	return nil
}

type memVoices struct {
	mu   sync.Mutex
	kept map[string]domain.Voice
}

func (v *memVoices) Keep(_ context.Context, chatID, id string, voice domain.Voice) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.kept == nil {
		v.kept = map[string]domain.Voice{}
	}
	v.kept[domain.KeyOf(chatID, id)] = voice
	return nil
}

func (v *memVoices) Find(_ context.Context, chatID, id string) (domain.Voice, bool, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	voice, ok := v.kept[domain.KeyOf(chatID, id)]
	return voice, ok, nil
}

func (v *memVoices) ClearVoiceNotes(context.Context) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.kept = nil
	return nil
}

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

func (o *memOutbox) Clear(context.Context) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.rows = nil
	return nil
}

type recorder struct {
	mu      sync.Mutex
	states  []domain.Status
	batches [][]domain.Inbound
	chats   [][]domain.KnownChat
	refuse  bool
}

func (r *recorder) Chats(batch []domain.KnownChat) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.chats = append(r.chats, append([]domain.KnownChat(nil), batch...))
}

func (r *recorder) chatFrames() [][]domain.KnownChat {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([][]domain.KnownChat(nil), r.chats...)
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
		Device: device, Outbox: outbox, VoiceNotes: &memVoices{}, Images: &memImages{}, Budget: budget, Now: func() time.Time { return now },
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

// The device's groups and contacts go to the link in frames of at most
// ChatsBatchMax, and again to every new link, so Settings lists them before
// anyone writes; unlinking forgets them. Breaks if a list is sent in one
// frame the control plane refuses, or a link that came up later never hears it.
func TestChatsGoToTheLinkInFramesAndAgainOnLinkUp(t *testing.T) {
	device := &fakeDevice{}
	svc, _, pub := started(t, device, nil)
	chats := make([]domain.KnownChat, domain.ChatsBatchMax+2)
	for i := range chats {
		chats[i] = domain.KnownChat{ChatID: fmt.Sprintf("3460000%04d@s.whatsapp.net", i), Kind: domain.ChatDirect}
	}
	svc.Chats(chats)
	frames := pub.chatFrames()
	if len(frames) != 2 || len(frames[0]) != domain.ChatsBatchMax || len(frames[1]) != 2 {
		t.Fatalf("frames of %v", frameSizes(frames))
	}
	svc.LinkUp(context.Background())
	if got := frameSizes(pub.chatFrames()); len(got) != 4 {
		t.Fatalf("a new link heard frames of %v", got)
	}
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.LinkUp(context.Background())
	if got := frameSizes(pub.chatFrames()); len(got) != 4 {
		t.Fatalf("an unlinked number's chats went out again: %v", got)
	}
}

func frameSizes(frames [][]domain.KnownChat) []int {
	sizes := make([]int, 0, len(frames))
	for _, f := range frames {
		sizes = append(sizes, len(f))
	}
	return sizes
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
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi", nil); codeOf(err) != "WA_002" {
		t.Fatalf("send without a device: %v", err)
	}
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if id, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi", nil); err != nil || id != "ID1" {
		t.Fatalf("send: %q %v", id, err)
	}
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "again", nil); codeOf(err) != "WA_004" {
		t.Fatalf("send past the budget: %v", err)
	}

	limited := &fakeDevice{sendErr: fmt.Errorf("%w: 429", domain.ErrRateLimited)}
	svc, _, _ = started(t, limited, domain.NewBudget(5, 10))
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi", nil); codeOf(err) != "WA_003" {
		t.Fatalf("rate-limited send: %v", err)
	}
	limited.sendErr = nil
	if _, _, err := svc.Send(context.Background(), "34600333444@s.whatsapp.net", "hi", nil); codeOf(err) != "WA_004" {
		t.Fatalf("send during WhatsApp's pause: %v", err)
	}
}

// A reply that quotes the owner's message reaches the device with its quote,
// and spends the same host budget as any send: it is refused past the
// budget (WA_004) and during WhatsApp's pause (WA_003, then 004). A quoted
// reply that skipped the budget would let answering burn the number's
// 20 a minute and 300 a day.
func TestQuotedSendSpendsTheBudget(t *testing.T) {
	owner := "34600333444@s.whatsapp.net"
	quote := &domain.Quote{ID: "3EB0A1", SenderID: owner}
	device := &fakeDevice{}
	svc, _, _ := started(t, device, domain.NewBudget(1, 10))
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.Send(context.Background(), owner, "hi", quote); err != nil {
		t.Fatalf("quoted send: %v", err)
	}
	if len(device.sent) != 1 || device.sent[0] != owner+": > 3EB0A1 hi" {
		t.Fatalf("sent %q, want the reply with its quote", device.sent)
	}
	if _, _, err := svc.Send(context.Background(), owner, "again", quote); codeOf(err) != "WA_004" {
		t.Fatalf("quoted send past the budget: %v", err)
	}

	limited := &fakeDevice{sendErr: fmt.Errorf("%w: 429", domain.ErrRateLimited)}
	svc, _, _ = started(t, limited, domain.NewBudget(5, 10))
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.Send(context.Background(), owner, "hi", quote); codeOf(err) != "WA_003" {
		t.Fatalf("rate-limited quoted send: %v", err)
	}
	limited.sendErr = nil
	if _, _, err := svc.Send(context.Background(), owner, "hi", quote); codeOf(err) != "WA_004" {
		t.Fatalf("quoted send during WhatsApp's pause: %v", err)
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

// Unlinking logs the device out, says the host is unlinked, and forgets what
// the number received and was never acked, so none of it reaches the next
// number linked on this host.
func TestUnlink(t *testing.T) {
	device := &fakeDevice{}
	svc, outbox, pub := started(t, device, nil)
	pub.refuse = true
	svc.Received(message("A"))
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !device.loggedOut || pub.last().State != domain.StateUnlinked {
		t.Fatalf("logged out %v, state %+v", device.loggedOut, pub.last())
	}
	if pending, _ := outbox.Pending(context.Background(), 10); len(pending) != 0 {
		t.Fatalf("an unlinked number's messages are still waiting: %v", pending)
	}
}

// A voice note that arrives goes out with how long it runs, and the control
// plane can then fetch its audio, once the message is acknowledged too; one
// the host does not know is WA_005, one past a frame WA_006, and unlinking
// forgets them all.
func TestVoiceNoteIsFetchedAfterTheAck(t *testing.T) {
	device := &fakeDevice{audio: []byte("OggS voice")}
	svc, outbox, pub := started(t, device, nil)
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	svc.LinkUp(context.Background())

	note := message("V1")
	note.Text, note.Media = "", domain.MediaAudio
	note.Voice = &domain.Voice{Ref: []byte("ref"), Seconds: 12, Size: 10}
	svc.Received(note)
	big := message("V2")
	big.Text, big.Media = "", domain.MediaAudio
	big.Voice = &domain.Voice{Ref: []byte("ref"), Seconds: 900, Size: domain.VoiceNoteMaxBytes + 1}
	svc.Received(big)

	pub.mu.Lock()
	sent := pub.batches[len(pub.batches)-1]
	pub.mu.Unlock()
	if got := sent[len(sent)-1]; got.ID != "V2" || got.VoiceSeconds != 900 {
		t.Fatalf("the voice note went out as %+v", got)
	}
	svc.Ack(context.Background(), []string{domain.KeyOf(note.ChatID, "V1")})
	if len(outbox.rows) != 1 {
		t.Fatalf("outbox after the ack: %+v", outbox.rows)
	}

	data, mimetype, err := svc.VoiceNote(context.Background(), note.ChatID, "V1")
	if err != nil || string(data) != "OggS voice" || mimetype != "audio/ogg; codecs=opus" {
		t.Fatalf("fetched %q %q %v", data, mimetype, err)
	}
	if _, _, err := svc.VoiceNote(context.Background(), note.ChatID, "V2"); codeOf(err) != "WA_006" {
		t.Fatalf("a voice note past a frame answered %v", err)
	}
	if _, _, err := svc.VoiceNote(context.Background(), note.ChatID, "nope"); codeOf(err) != "WA_005" {
		t.Fatalf("an unknown voice note answered %v", err)
	}
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.VoiceNote(context.Background(), note.ChatID, "V1"); codeOf(err) != "WA_005" {
		t.Fatalf("after unlinking, a kept voice note answered %v", err)
	}
}

// An image that arrives is kept, so the control plane can fetch it after
// the ack for a bot to see; one the host does not know is WA_005, one past
// what is downloaded at all WA_006 before anything is fetched, and
// unlinking forgets them all.
func TestImageIsFetchedAfterTheAck(t *testing.T) {
	device := &fakeDevice{image: []byte("small jpeg")}
	svc, _, pub := started(t, device, nil)
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	svc.LinkUp(context.Background())

	photo := message("I1")
	photo.Text, photo.Media = "look", domain.MediaImage
	photo.Image = &domain.Image{Ref: []byte("ref"), Size: 10}
	svc.Received(photo)
	huge := message("I2")
	huge.Text, huge.Media = "", domain.MediaImage
	huge.Image = &domain.Image{Ref: []byte("ref"), Size: domain.ImageDownloadMaxBytes + 1}
	svc.Received(huge)
	pub.mu.Lock()
	sent := pub.batches[len(pub.batches)-1]
	pub.mu.Unlock()
	if got := sent[len(sent)-1]; got.ID != "I2" || got.Media != domain.MediaImage {
		t.Fatalf("the image went out as %+v", got)
	}
	svc.Ack(context.Background(), []string{domain.KeyOf(photo.ChatID, "I1")})

	data, mimetype, err := svc.Image(context.Background(), photo.ChatID, "I1")
	if err != nil || string(data) != "small jpeg" || mimetype != "image/jpeg" {
		t.Fatalf("fetched %q %q %v", data, mimetype, err)
	}
	if _, _, err := svc.Image(context.Background(), photo.ChatID, "I2"); codeOf(err) != "WA_006" {
		t.Fatalf("an image past the download cap answered %v", err)
	}
	if _, _, err := svc.Image(context.Background(), photo.ChatID, "V1"); codeOf(err) != "WA_005" {
		t.Fatalf("an unknown image answered %v", err)
	}
	if err := svc.Unlink(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.Image(context.Background(), photo.ChatID, "I1"); codeOf(err) != "WA_005" {
		t.Fatalf("after unlinking, a kept image answered %v", err)
	}
}

// oggOpus is the smallest audio CheckVoiceOut takes: one Ogg page, no
// segments, carrying the Opus identification header.
func oggOpus(size int) []byte {
	head := append([]byte("OggS"), make([]byte, 23)...)
	head = append(head, []byte("OpusHead")...)
	if size > len(head) {
		head = append(head, make([]byte, size-len(head))...)
	}
	return head
}

// A voice note reaches the device only from a connected number, only as
// Ogg/Opus within a frame (WA_008, WA_006, before any budget is spent), and
// spends the same host budget a text does, so speaking cannot get round the
// number's send limits; WhatsApp's 429 on it pauses every send (WA_003, then
// WA_004). A voice path that skipped the budget would let a bot burn the
// number by answering aloud.
func TestSendVoiceRefusalsAndBudget(t *testing.T) {
	chat := "34600333444@s.whatsapp.net"
	device := &fakeDevice{}
	svc, _, _ := started(t, device, domain.NewBudget(1, 10))
	if _, _, err := svc.SendVoice(context.Background(), chat, oggOpus(64), 3); codeOf(err) != "WA_002" {
		t.Fatalf("voice without a device: %v", err)
	}
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.SendVoice(context.Background(), chat, []byte("RIFF....WAVEfmt "), 3); codeOf(err) != "WA_008" {
		t.Fatalf("a WAV sent as a voice note: %v", err)
	}
	if _, _, err := svc.SendVoice(context.Background(), chat, oggOpus(domain.VoiceNoteMaxBytes+1), 3); codeOf(err) != "WA_006" {
		t.Fatalf("a voice note past a frame: %v", err)
	}
	if _, _, err := svc.SendVoice(context.Background(), chat, oggOpus(64), 0); codeOf(err) != "WA_008" {
		t.Fatalf("a voice note of no length: %v", err)
	}
	id, _, err := svc.SendVoice(context.Background(), chat, oggOpus(64), 3)
	if err != nil || id != "ID1" || len(device.sent) != 1 || device.sent[0] != chat+": voice 3s 64B" {
		t.Fatalf("voice: %q %v %v", id, err, device.sent)
	}
	if _, _, err := svc.Send(context.Background(), chat, "and a text", nil); codeOf(err) != "WA_004" {
		t.Fatalf("a text after the voice note spent the budget: %v", err)
	}

	limited := &fakeDevice{sendErr: fmt.Errorf("%w: 429", domain.ErrRateLimited)}
	svc, _, _ = started(t, limited, domain.NewBudget(5, 10))
	svc.Connected("34600111222@s.whatsapp.net", "Jordi")
	if _, _, err := svc.SendVoice(context.Background(), chat, oggOpus(64), 3); codeOf(err) != "WA_003" {
		t.Fatalf("rate-limited voice: %v", err)
	}
	limited.sendErr = nil
	if _, _, err := svc.Send(context.Background(), chat, "hi", nil); codeOf(err) != "WA_004" {
		t.Fatalf("send during WhatsApp's pause after a voice note: %v", err)
	}
}
