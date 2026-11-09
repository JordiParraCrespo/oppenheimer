package cli

import (
	"bytes"
	"context"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/adapters/botapi"
	tgapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	tgdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// refusingBotAPI is a Bot API that refuses every token.
type refusingBotAPI struct{}

func (refusingBotAPI) GetMe(context.Context, string) (tgdomain.Bot, error) {
	return tgdomain.Bot{}, tgdomain.ErrUnauthorized
}
func (refusingBotAPI) DeleteWebhook(context.Context, string) error { return nil }
func (refusingBotAPI) GetUpdates(context.Context, string, int64, time.Duration) ([]tgapp.Update, error) {
	return nil, tgdomain.ErrUnauthorized
}
func (refusingBotAPI) SendMessage(context.Context, string, string, string, string) (string, time.Time, error) {
	return "", time.Time{}, tgdomain.ErrUnauthorized
}

// syncBuffer is a log the handler's lanes write to while the test reads it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func telegramHandler(t *testing.T, offered bool) (*linkHandler, *capturedLink, *syncBuffer) {
	t.Helper()
	logs := &syncBuffer{}
	logger := slog.New(slog.NewTextHandler(logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	sent := &capturedLink{}
	a := &App{}
	if offered {
		a.Telegram = tgapp.New(tgapp.Options{API: refusingBotAPI{}, Store: botapi.NewStore(t.TempDir(), logger), Logger: logger})
	} else {
		t.Setenv(EnvTelegram, "off")
	}
	h := &linkHandler{
		app: a, logger: logger, client: sent, reporter: link.NewReporter("run-test", sent, logger),
		attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		life: context.Background(), lanes: newLanes(),
	}
	t.Cleanup(func() { h.lanes.close(time.Second) })
	h.startTelegram(logger)
	return h, sent, logs
}

// The capability is named only by a host that holds a Telegram service, so
// the control plane never hands a token to one that cannot poll.
func TestTelegramCapabilityOnlyWhenOffered(t *testing.T) {
	on, _, _ := telegramHandler(t, true)
	if !slices.Contains(on.capabilities(), link.CapabilityTelegram) {
		t.Fatal("a host with Telegram does not name the capability")
	}
	off, _, _ := telegramHandler(t, false)
	if slices.Contains(off.capabilities(), link.CapabilityTelegram) {
		t.Fatal("a host with RUNNER_TELEGRAM=off names the capability")
	}
}

// A send with no connected bot is refused with TG_003, the code the control
// plane tells the person "the bot is not connected" by.
func TestTelegramSendWithoutABotIsRefused(t *testing.T) {
	for _, offered := range []bool{true, false} {
		h, sent, _ := telegramHandler(t, offered)
		h.Message(context.Background(), message(t, link.TypeTelegramSend, map[string]any{
			"commandId": "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "chatId": "123", "text": "hi",
		}))
		failed := waitFor(t, sent, func(m any) bool { _, ok := m.(link.CommandFailed); return ok })
		if got := failed.(link.CommandFailed); got.Code != "TG_003" || got.CommandID != "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e" {
			t.Fatalf("offered=%v: %+v", offered, got)
		}
	}
}

// A token Telegram refuses is TG_001, and the token itself appears in
// nothing the runner logs or sends back.
func TestTelegramRefusedTokenIsNeitherLoggedNorEchoed(t *testing.T) {
	h, sent, logs := telegramHandler(t, true)
	const secret = "7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
	h.Message(context.Background(), message(t, link.TypeTelegramLink, map[string]any{
		"commandId": "c3d4e5f6-7a8b-4c9d-8e0f-1a2b3c4d5e6f", "token": secret,
	}))
	failed := waitFor(t, sent, func(m any) bool { _, ok := m.(link.CommandFailed); return ok })
	got := failed.(link.CommandFailed)
	if got.Code != "TG_001" {
		t.Fatalf("%+v", got)
	}
	if strings.Contains(got.Detail, "AAHdq") || strings.Contains(logs.String(), "AAHdq") {
		t.Fatal("the token reached the log or the link")
	}
}

// A new link hears how the bot stands.
func TestTelegramStateOnLinkUp(t *testing.T) {
	h, sent, _ := telegramHandler(t, true)
	h.Connected(context.Background(), 1)
	state := waitFor(t, sent, func(m any) bool { _, ok := m.(link.TelegramState); return ok })
	if got := state.(link.TelegramState); got.State != "unlinked" || got.Type != link.TypeTelegramState {
		t.Fatalf("%+v", got)
	}
}
