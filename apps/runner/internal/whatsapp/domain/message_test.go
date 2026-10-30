package domain_test

import (
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

var now = time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)

func chat(mod func(*domain.Received)) domain.Received {
	r := domain.Received{
		Where: domain.WhereChat, ID: "3EB0A1", ChatID: "34600333444@s.whatsapp.net", ChatKind: domain.ChatDirect,
		ChatName: "Marta", SenderID: "34600333444@s.whatsapp.net", SenderName: "Marta",
		Text: "Are we still on for Tuesday?", SentAt: now.Add(-time.Minute),
	}
	if mod != nil {
		mod(&r)
	}
	return r
}

// A direct message is handed on whole, keyed by its chat and id, which is
// what `whatsapp.ack` names.
func TestAdmitHandsOnAMessageKeyedByChatAndID(t *testing.T) {
	got, ok := domain.Admit(chat(nil), now, time.Time{})
	if !ok {
		t.Fatal("a fresh direct message was dropped")
	}
	if got.Key != "34600333444@s.whatsapp.net/3EB0A1" || got.ChatKind != domain.ChatDirect || got.Text != "Are we still on for Tuesday?" {
		t.Fatalf("got %+v", got)
	}
}

// Media with no caption still counts (the bot is told a photo arrived), and
// a group stays a group; the owner's own messages from the phone come too.
func TestAdmitKeepsMediaGroupsAndTheOwnersOwnMessages(t *testing.T) {
	got, ok := domain.Admit(chat(func(r *domain.Received) {
		r.Text, r.Media, r.ChatKind, r.FromMe = "", domain.MediaImage, domain.ChatGroup, true
	}), now, time.Time{})
	if !ok || got.Media != domain.MediaImage || got.ChatKind != domain.ChatGroup || !got.FromMe {
		t.Fatalf("got %+v, %v", got, ok)
	}
}

// What nobody wrote to the owner, what carries nothing, and what is old are
// never handed on: OpenClaw's rules for keeping a number safe.
func TestAdmitDrops(t *testing.T) {
	paired := now.Add(-30 * time.Second)
	for name, r := range map[string]domain.Received{
		"status update":       chat(func(r *domain.Received) { r.Where = domain.WhereStatus }),
		"broadcast list":      chat(func(r *domain.Received) { r.Where = domain.WhereBroadcast }),
		"newsletter":          chat(func(r *domain.Received) { r.Where = domain.WhereNewsletter }),
		"no text or media":    chat(func(r *domain.Received) { r.Text = "" }),
		"sent before pairing": chat(func(r *domain.Received) { r.SentAt = paired.Add(-time.Second) }),
		"too old":             chat(func(r *domain.Received) { r.SentAt = now.Add(-domain.MaxAge - time.Second) }),
		"no id":               chat(func(r *domain.Received) { r.ID = "" }),
	} {
		if _, ok := domain.Admit(r, now, paired); ok {
			t.Errorf("%s: admitted", name)
		}
	}
}

// A long text is cut to what the control plane's schema takes, counted the
// way it counts (UTF-16 units), and says it was cut.
func TestCutTextFitsTheSchemaInUTF16Units(t *testing.T) {
	long := strings.Repeat("😀", domain.TextMaxChars) // two units each
	cut := domain.CutText(long)
	if units := len(utf16.Encode([]rune(cut))); units > domain.TextMaxChars {
		t.Fatalf("cut text is %d units, over %d", units, domain.TextMaxChars)
	}
	if !strings.HasSuffix(cut, domain.CutMark) {
		t.Fatal("a cut text does not say it was cut")
	}
	if short := "hola"; domain.CutText(short) != short {
		t.Fatal("a short text was changed")
	}
}
