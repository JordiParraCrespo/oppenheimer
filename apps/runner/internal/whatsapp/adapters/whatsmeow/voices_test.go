package whatsmeow

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// A kept voice note is found by its chat and id until domain.VoiceNoteKept
// has passed, and kept once however often it arrives.
func TestVoicesForgetPastTheirKeep(t *testing.T) {
	ctx := context.Background()
	db, err := openDB(filepath.Join(t.TempDir(), "whatsapp"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	voices, err := newVoices(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 11, 18, 12, 0, 0, 0, time.UTC)
	voices.now = func() time.Time { return at }
	chat := "34600333444@s.whatsapp.net"
	note := domain.Voice{Ref: []byte{1, 2, 3}, Seconds: 12, Size: 4096}
	for range 2 {
		if err := voices.Keep(ctx, chat, "V1", note); err != nil {
			t.Fatal(err)
		}
	}
	got, ok, err := voices.Find(ctx, chat, "V1")
	if err != nil || !ok || string(got.Ref) != string(note.Ref) || got.Seconds != 12 || got.Size != 4096 {
		t.Fatalf("found %+v %v %v", got, ok, err)
	}
	if _, ok, _ := voices.Find(ctx, "34600999999@s.whatsapp.net", "V1"); ok {
		t.Fatal("found a voice note under another chat")
	}
	at = at.Add(domain.VoiceNoteKept + time.Minute)
	if _, ok, _ := voices.Find(ctx, chat, "V1"); ok {
		t.Fatal("found a voice note past its keep")
	}
}
