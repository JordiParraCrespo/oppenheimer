package botapi

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

func inbound(key string) domain.Inbound {
	return domain.Inbound{Key: key, ID: key, ChatID: "123", ChatKind: domain.ChatDirect, SenderID: "123", Text: "x"}
}

// The token and the outbox are readable by the runner's user only, and what
// is kept survives a restart: the offset and the messages move together.
func TestStoreKeepsTokenAndOutboxPrivatelyAcrossRestarts(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "telegram")
	ctx := context.Background()
	s := NewStore(dir, nil)
	bot := domain.Bot{ID: "7012345678", Username: "shop_bot"}
	if err := s.Hold(ctx, token, bot); err != nil {
		t.Fatal(err)
	}
	if err := s.Advance(ctx, 11, []domain.Inbound{inbound("123/1"), inbound("123/2")}); err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]os.FileMode{dir: 0o700, filepath.Join(dir, TokenFile): 0o600, filepath.Join(dir, StateFile): 0o600} {
		info, err := os.Stat(path)
		if err != nil || info.Mode().Perm() != want {
			t.Fatalf("%s: %v %v", path, info.Mode().Perm(), err)
		}
	}
	again := NewStore(dir, nil)
	held, err := again.Load(ctx)
	if err != nil || held.Token != token || held.Offset != 11 || held.Bot.ID != bot.ID {
		t.Fatalf("%+v %v", held, err)
	}
	if err := again.Ack(ctx, []string{"123/1"}); err != nil {
		t.Fatal(err)
	}
	pending, _ := NewStore(dir, nil).Pending(ctx, 10)
	if len(pending) != 1 || pending[0].Key != "123/2" {
		t.Fatalf("pending %+v", pending)
	}
}

// A new token for the same bot keeps its offset and outbox; another bot
// starts afresh, so it never reads the first one's updates.
func TestStoreHoldKeepsTheSameBotsOffsetOnly(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()
	s := NewStore(dir, nil)
	_ = s.Hold(ctx, token, domain.Bot{ID: "1"})
	_ = s.Advance(ctx, 5, []domain.Inbound{inbound("123/1")})
	_ = s.Hold(ctx, "1:newtoken-newtoken-newtoken", domain.Bot{ID: "1"})
	if held, _ := s.Load(ctx); held.Offset != 5 {
		t.Fatalf("same bot lost its offset: %d", held.Offset)
	}
	_ = s.Hold(ctx, "2:othertoken-othertoken-other", domain.Bot{ID: "2"})
	held, _ := s.Load(ctx)
	pending, _ := s.Pending(ctx, 10)
	if held.Offset != 0 || len(pending) != 0 {
		t.Fatalf("another bot kept offset %d, %d waiting", held.Offset, len(pending))
	}
}

// Forgetting deletes the token from disk, not just from memory.
func TestStoreForgetDeletesTheToken(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()
	s := NewStore(dir, nil)
	_ = s.Hold(ctx, token, domain.Bot{ID: "1"})
	_ = s.Advance(ctx, 5, []domain.Inbound{inbound("123/1")})
	if err := s.Forget(ctx); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{TokenFile, StateFile} {
		if _, err := os.Stat(filepath.Join(dir, name)); !os.IsNotExist(err) {
			t.Fatalf("%s still on disk", name)
		}
	}
	if held, _ := NewStore(dir, nil).Load(ctx); held.Token != "" {
		t.Fatal("a forgotten token was read back")
	}
}
