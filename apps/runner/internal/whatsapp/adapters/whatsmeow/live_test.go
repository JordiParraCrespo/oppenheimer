package whatsmeow

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// WhatsApp still lets this runner pair: a fresh device asks WhatsApp's
// servers for a QR code, the first step of linking a number. WhatsApp refuses
// a client it calls outdated (err-client-outdated) or a protocol whatsmeow no
// longer speaks before it hands out a code, and nothing short of WhatsApp
// itself shows either. It talks to WhatsApp, so it runs only with
// RUNNER_WHATSAPP_LIVE=1; the scheduled WhatsApp check runs it daily.
func TestLiveWhatsAppHandsOutAPairingCode(t *testing.T) {
	if os.Getenv("RUNNER_WHATSAPP_LIVE") != "1" {
		t.Skip("set RUNNER_WHATSAPP_LIVE=1 to ask WhatsApp's servers for a pairing code")
	}
	device := New(Options{Dir: t.TempDir(), Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if _, err := device.Open(ctx, noEvents{}); err != nil {
		t.Fatalf("open the store: %v", err)
	}
	t.Cleanup(device.Close)

	got := false
	_, err := device.Pair(ctx, func(string, time.Time) {
		got = true
		cancel()
	})
	if got {
		return
	}
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		t.Fatalf("WhatsApp sent no pairing code within a minute: %v", err)
	}
	t.Fatalf("WhatsApp refused to pair: %v", err)
}

type noEvents struct{}

func (noEvents) Received(domain.Received) {}
func (noEvents) Connected(string, string) {}
func (noEvents) Disconnected()            {}
func (noEvents) LoggedOut(string)         {}
