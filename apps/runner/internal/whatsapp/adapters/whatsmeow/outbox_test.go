package whatsmeow

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

func inbound(id string) domain.Inbound {
	return domain.Inbound{
		Key: domain.KeyOf("34600333444@s.whatsapp.net", id), ID: id,
		ChatID: "34600333444@s.whatsapp.net", ChatKind: domain.ChatDirect,
		SenderID: "34600333444@s.whatsapp.net", Text: "hola " + id,
		SentAt: time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC),
	}
}

// What the control plane has not acknowledged survives a restart, once per
// key, oldest first; an ack forgets it.
func TestOutboxSurvivesReopenAndForgetsWhatWasAcked(t *testing.T) {
	ctx := context.Background()
	dir := filepath.Join(t.TempDir(), "whatsapp")
	box, err := OpenOutbox(ctx, dir, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"A", "B", "A", "C"} {
		if err := box.Put(ctx, inbound(id)); err != nil {
			t.Fatal(err)
		}
	}
	if err := box.Close(); err != nil {
		t.Fatal(err)
	}

	box, err = OpenOutbox(ctx, dir, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer box.Close()
	pending, err := box.Pending(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 3 || pending[0].ID != "A" || pending[2].ID != "C" || pending[1].Text != "hola B" {
		t.Fatalf("after reopen: %+v", pending)
	}
	if err := box.Ack(ctx, []string{pending[0].Key, pending[2].Key}); err != nil {
		t.Fatal(err)
	}
	pending, _ = box.Pending(ctx, 10)
	if len(pending) != 1 || pending[0].ID != "B" {
		t.Fatalf("after the ack: %+v", pending)
	}
}

// The file holds the device's keys: its directory and the file are the
// runner's user's alone, whatever they were before.
func TestStoreIsReadableByTheRunnerOnly(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "whatsapp")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	box, err := OpenOutbox(context.Background(), dir, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer box.Close()
	for path, want := range map[string]os.FileMode{dir: 0o700, filepath.Join(dir, FileName): 0o600} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("%s is %o, want %o", path, got, want)
		}
	}
}
