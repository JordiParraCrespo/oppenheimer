package cli

import (
	"context"
	"io"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	waapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	wadomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// noDevice is a WhatsApp store with nothing paired that never pairs.
type noDevice struct{}

func (noDevice) Open(context.Context, waapp.Events) (waapp.Paired, error) { return waapp.Paired{}, nil }
func (noDevice) Connect(context.Context) error                            { return nil }
func (noDevice) Pair(context.Context, func(string, time.Time)) (waapp.Paired, error) {
	return waapp.Paired{}, context.Canceled
}
func (noDevice) Logout(context.Context) error { return nil }
func (noDevice) Send(context.Context, string, string, *wadomain.Quote) (string, time.Time, error) {
	return "", time.Time{}, nil
}
func (noDevice) SendVoice(context.Context, string, []byte, int) (string, time.Time, error) {
	return "", time.Time{}, nil
}
func (noDevice) Download(context.Context, []byte) ([]byte, string, error) {
	return nil, "", nil
}
func (noDevice) DownloadImage(context.Context, []byte, int) ([]byte, string, error) {
	return nil, "", nil
}
func (noDevice) Close() {}

// emptyOutbox keeps nothing.
type emptyOutbox struct{}

func (emptyOutbox) Put(context.Context, wadomain.Inbound) error { return nil }
func (emptyOutbox) Pending(context.Context, int) ([]wadomain.Inbound, error) {
	return nil, nil
}
func (emptyOutbox) Ack(context.Context, []string) error { return nil }
func (emptyOutbox) Clear(context.Context) error         { return nil }

func whatsAppHandler(t *testing.T, offered bool) (*linkHandler, *capturedLink) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sent := &capturedLink{}
	a := &App{}
	if offered {
		a.WhatsApp = waapp.New(waapp.Options{Device: noDevice{}, Outbox: emptyOutbox{}, Logger: logger})
	} else {
		t.Setenv(EnvWhatsApp, "off")
	}
	h := &linkHandler{
		app: a, logger: logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(time.Second) })
	h.startWhatsApp(logger)
	return h, sent
}

// The capability is named only by a host that holds a WhatsApp service, so
// the control plane never asks one that cannot pair.
func TestWhatsAppCapabilityOnlyWhenOffered(t *testing.T) {
	on, _ := whatsAppHandler(t, true)
	if !slices.Contains(on.capabilities(), link.CapabilityWhatsapp) {
		t.Fatal("a host with WhatsApp does not name the capability")
	}
	off, _ := whatsAppHandler(t, false)
	if slices.Contains(off.capabilities(), link.CapabilityWhatsapp) {
		t.Fatal("a host with RUNNER_WHATSAPP=off names the capability")
	}
}

// A send with no connected device is refused with WA_002, the code the
// control plane tells the person "the device is not connected" by.
func TestWhatsAppSendWithoutADeviceIsRefused(t *testing.T) {
	for _, offered := range []bool{true, false} {
		h, sent := whatsAppHandler(t, offered)
		h.Message(context.Background(), message(t, link.TypeWhatsappSend, map[string]any{
			"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "chatId": "34600333444@s.whatsapp.net", "text": "hi",
		}))
		failed := waitFor(t, sent, func(m any) bool { _, ok := m.(link.CommandFailed); return ok })
		if got := failed.(link.CommandFailed); got.Code != "WA_002" || got.CommandID != "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e" {
			t.Fatalf("offered=%v: %+v", offered, got)
		}
	}
}

// A host that holds WhatsApp names that it sends voice notes, so the control
// plane sends `whatsapp.send.voice` only where an answer will come; a voice
// note asked of a host with no connected device is refused with WA_002,
// as a text is, never left unanswered.
func TestWhatsAppVoiceSend(t *testing.T) {
	on, _ := whatsAppHandler(t, true)
	if !slices.Contains(on.capabilities(), link.CapabilityWhatsappVoiceSend) {
		t.Fatal("a host with WhatsApp does not name voice sends")
	}
	for _, offered := range []bool{true, false} {
		h, sent := whatsAppHandler(t, offered)
		h.Message(context.Background(), message(t, link.TypeWhatsappSendVoice, map[string]any{
			"commandId": "c3d4e5f6-7a8b-4c9d-8e0f-2a3b4c5d6e7f", "chatId": "34600333444@s.whatsapp.net",
			"mimetype": "audio/ogg; codecs=opus", "data": "T2dnUwACAAAAAAAAAAA=", "seconds": 2,
		}))
		failed := waitFor(t, sent, func(m any) bool { _, ok := m.(link.CommandFailed); return ok })
		if got := failed.(link.CommandFailed); got.Code != "WA_002" || got.CommandID != "c3d4e5f6-7a8b-4c9d-8e0f-2a3b4c5d6e7f" {
			t.Fatalf("offered=%v: %+v", offered, got)
		}
	}
}

// A new link hears how the device stands.
func TestWhatsAppStateOnLinkUp(t *testing.T) {
	h, sent := whatsAppHandler(t, true)
	h.Connected(context.Background(), 1)
	state := waitFor(t, sent, func(m any) bool { _, ok := m.(link.WhatsappState); return ok })
	if got := state.(link.WhatsappState); got.State != "unlinked" || got.Type != link.TypeWhatsappState {
		t.Fatalf("%+v", got)
	}
}

func waitFor(t *testing.T, sent *capturedLink, match func(any) bool) any {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		sent.mu.Lock()
		for _, m := range sent.sent {
			if match(m) {
				sent.mu.Unlock()
				return m
			}
		}
		sent.mu.Unlock()
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("the link was never sent the message")
	return nil
}
