package app

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// A bot new to this host can bring more than one page of old updates: the
// age filter holds for every page until a poll comes back empty, so the
// second page of a day-old backlog is dropped too, while a live message in
// it still passes.
func TestFreshBacklogIsFilteredUntilDrained(t *testing.T) {
	api, store := newFakeAPI(), &memStore{}
	stale := func(id int64, text string) Update {
		u := update(id, text)
		u.SentAt = time.Now().Add(-2 * time.Hour)
		return u
	}
	api.updates <- []Update{stale(1, "old-a"), stale(2, "old-b")}
	api.updates <- []Update{stale(3, "old-c"), update(4, "live")}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p := &poller{
		api: api, store: store, logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		now: time.Now, sleep: func(context.Context, time.Duration) {}, wait: 10 * time.Millisecond,
		token: token, report: func(domain.Event) {}, kept: func(context.Context) {},
	}
	done := make(chan struct{})
	go func() { defer close(done); p.run(ctx, true) }()

	eventually(t, "both pages polled past", func() bool {
		store.mu.Lock()
		defer store.mu.Unlock()
		return store.held.Offset == 5
	})
	cancel()
	<-done

	store.mu.Lock()
	defer store.mu.Unlock()
	if len(store.messages) != 1 || store.messages[0].Text != "live" {
		texts := []string{}
		for _, m := range store.messages {
			texts = append(texts, m.Text)
		}
		t.Fatalf("kept %v, want only the live message", texts)
	}
}
