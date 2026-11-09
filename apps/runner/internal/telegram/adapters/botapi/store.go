package botapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// The store's files in the Telegram state directory. The token is its own
// file so the outbox, written on every poll, never rewrites it.
const (
	TokenFile = "bot.json"
	StateFile = "state.json"
)

// Store is app.Store over two JSON files, each written whole to a temporary
// file and renamed over the old one, so a crash leaves one or the other.
type Store struct {
	dir    string
	logger *slog.Logger

	mu     sync.Mutex
	loaded bool
	bot    heldBot
	state  outbox
}

var _ app.Store = (*Store)(nil)

type heldBot struct {
	Token string     `json:"token"`
	Bot   domain.Bot `json:"bot"`
}

type outbox struct {
	// BotID is the bot the offset and messages belong to.
	BotID    string           `json:"botId"`
	Offset   int64            `json:"offset"`
	Messages []domain.Inbound `json:"messages"`
}

// NewStore is a store in dir, which it makes 0700 on first write.
func NewStore(dir string, logger *slog.Logger) *Store {
	if logger == nil {
		logger = slog.Default()
	}
	return &Store{dir: dir, logger: logger}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	if err := readJSON(filepath.Join(s.dir, TokenFile), &s.bot); err != nil {
		return err
	}
	if err := readJSON(filepath.Join(s.dir, StateFile), &s.state); err != nil {
		return err
	}
	if s.state.BotID != s.bot.Bot.ID {
		s.state = outbox{BotID: s.bot.Bot.ID}
	}
	s.loaded = true
	return nil
}

func readJSON(path string, into any) error {
	raw, err := os.ReadFile(path) //nolint:gosec // the runner's own state directory
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, into); err != nil {
		return fmt.Errorf("telegram store: %s is unreadable", filepath.Base(path))
	}
	return nil
}

// writeJSON writes v to name in the store's directory, 0600, atomically.
func (s *Store) writeJSON(name string, v any) error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	if err := os.Chmod(s.dir, 0o700); err != nil { //nolint:gosec // a directory: 0700 is the private mode
		return err
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.dir, name+".*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(raw); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filepath.Join(s.dir, name))
}

// Load reads what is held.
func (s *Store) Load(context.Context) (app.Held, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return app.Held{}, err
	}
	return app.Held{Token: s.bot.Token, Bot: s.bot.Bot, Offset: s.state.Offset}, nil
}

// Hold keeps a token; a bot other than the one held starts afresh.
func (s *Store) Hold(_ context.Context, token string, bot domain.Bot) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	next := heldBot{Token: token, Bot: bot}
	if err := s.writeJSON(TokenFile, next); err != nil {
		return err
	}
	s.bot = next
	if s.state.BotID != bot.ID {
		fresh := outbox{BotID: bot.ID}
		if err := s.writeJSON(StateFile, fresh); err != nil {
			return err
		}
		s.state = fresh
	}
	return nil
}

// Advance keeps messages and moves the offset in one write.
func (s *Store) Advance(_ context.Context, offset int64, messages []domain.Inbound) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	next := outbox{BotID: s.state.BotID, Offset: offset, Messages: append([]domain.Inbound(nil), s.state.Messages...)}
	seen := make(map[string]bool, len(next.Messages))
	for _, m := range next.Messages {
		seen[m.Key] = true
	}
	for _, m := range messages {
		if !seen[m.Key] {
			next.Messages = append(next.Messages, m)
			seen[m.Key] = true
		}
	}
	if dropped := len(next.Messages) - domain.OutboxMax; dropped > 0 {
		next.Messages = next.Messages[dropped:]
		s.logger.Warn("telegram: the outbox is full; the oldest messages were dropped",
			slog.Int("dropped", dropped), slog.Int("kept", domain.OutboxMax))
	}
	if err := s.writeJSON(StateFile, next); err != nil {
		return err
	}
	s.state = next
	return nil
}

// Pending is up to limit messages, oldest first.
func (s *Store) Pending(_ context.Context, limit int) ([]domain.Inbound, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	n := min(limit, len(s.state.Messages))
	return append([]domain.Inbound(nil), s.state.Messages[:n]...), nil
}

// Ack forgets the messages under keys.
func (s *Store) Ack(_ context.Context, keys []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	drop := make(map[string]bool, len(keys))
	for _, k := range keys {
		drop[k] = true
	}
	next := outbox{BotID: s.state.BotID, Offset: s.state.Offset}
	for _, m := range s.state.Messages {
		if !drop[m.Key] {
			next.Messages = append(next.Messages, m)
		}
	}
	if len(next.Messages) == len(s.state.Messages) {
		return nil
	}
	if err := s.writeJSON(StateFile, next); err != nil {
		return err
	}
	s.state = next
	return nil
}

// Forget deletes the token, the offset and every message waiting.
func (s *Store) Forget(context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var errs []error
	for _, name := range []string{TokenFile, StateFile} {
		if err := os.Remove(filepath.Join(s.dir, name)); err != nil && !errors.Is(err, fs.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	s.bot, s.state, s.loaded = heldBot{}, outbox{}, true
	return errors.Join(errs...)
}
