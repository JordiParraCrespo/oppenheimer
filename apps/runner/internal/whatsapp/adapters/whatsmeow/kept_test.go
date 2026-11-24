package whatsmeow

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// Kept media is found by its kind, chat and id until domain.MediaKept has
// passed, and kept once however often it arrives; a voice note and an image
// with one id stay apart, and clearing forgets both. Breaks if an image's ref
// is read back as a voice note's.
func TestKeptMediaForgetPastItsKeep(t *testing.T) {
	ctx := context.Background()
	db, err := openDB(filepath.Join(t.TempDir(), "whatsapp"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	store, err := newKeptMedia(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 11, 18, 12, 0, 0, 0, time.UTC)
	for _, table := range store.tables {
		table.now = func() time.Time { return at }
	}
	chat := "34600333444@s.whatsapp.net"
	note := domain.Kept{Kind: domain.KeptVoice, Ref: []byte{1, 2, 3}, Seconds: 12, Size: 4096}
	photo := domain.Kept{Kind: domain.KeptImage, Ref: []byte{4, 5}, Size: 90000}
	for range 2 {
		if err := store.Keep(ctx, chat, "M1", note); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.Keep(ctx, chat, "M1", photo); err != nil {
		t.Fatal(err)
	}
	got, ok, err := store.Find(ctx, domain.KeptVoice, chat, "M1")
	if err != nil || !ok || string(got.Ref) != string(note.Ref) || got.Seconds != 12 || got.Size != 4096 {
		t.Fatalf("found voice %+v %v %v", got, ok, err)
	}
	got, ok, err = store.Find(ctx, domain.KeptImage, chat, "M1")
	if err != nil || !ok || string(got.Ref) != string(photo.Ref) || got.Kind != domain.KeptImage {
		t.Fatalf("found image %+v %v %v", got, ok, err)
	}
	if _, ok, _ := store.Find(ctx, domain.KeptVoice, "34600999999@s.whatsapp.net", "M1"); ok {
		t.Fatal("found media under another chat")
	}
	at = at.Add(domain.MediaKept + time.Minute)
	if _, ok, _ := store.Find(ctx, domain.KeptVoice, chat, "M1"); ok {
		t.Fatal("found a voice note past its keep")
	}
	at = at.Add(-domain.MediaKept)
	if err := store.ClearKept(ctx); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := store.Find(ctx, domain.KeptImage, chat, "M1"); ok {
		t.Fatal("found an image after clearing")
	}
}
