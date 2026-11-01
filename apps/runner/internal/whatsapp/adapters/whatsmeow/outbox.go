package whatsmeow

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"

	// The SQL driver: pure Go, so the runner stays one static binary.
	_ "modernc.org/sqlite"
)

// FileName is the store's file in the WhatsApp state directory: whatsmeow's
// tables (the device's keys) and the outbox, one file.
const FileName = "whatsapp.db"

const outboxSchema = `CREATE TABLE IF NOT EXISTS opp_whatsapp_outbox (
	seq        INTEGER PRIMARY KEY AUTOINCREMENT,
	key        TEXT NOT NULL UNIQUE,
	body       TEXT NOT NULL,
	created_at INTEGER NOT NULL
)`

// openDB opens the store's file, making its directory 0700 and the file 0600
// first: it holds the device's keys, which are the number.
func openDB(dir string) (*sql.DB, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(dir, 0o700); err != nil { //nolint:gosec // a directory: 0700 is the private mode, it must be traversable by its owner
		return nil, err
	}
	path := filepath.Join(dir, FileName)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600) //nolint:gosec // the runner's own state directory, named by the runner
	if err != nil {
		return nil, err
	}
	_ = f.Close()
	if err := os.Chmod(path, 0o600); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	// One writer: SQLite serialises them anyway, and one connection keeps
	// the pragmas on every statement.
	db.SetMaxOpenConns(1)
	return db, nil
}

// Outbox is app.Outbox over a table of the store's file.
type Outbox struct {
	db     *sql.DB
	logger *slog.Logger
	now    func() time.Time
}

var _ app.Outbox = (*Outbox)(nil)

// OpenOutbox opens (or makes) the outbox in dir.
func OpenOutbox(ctx context.Context, dir string, logger *slog.Logger) (*Outbox, error) {
	db, err := openDB(dir)
	if err != nil {
		return nil, err
	}
	return newOutbox(ctx, db, logger)
}

func newOutbox(ctx context.Context, db *sql.DB, logger *slog.Logger) (*Outbox, error) {
	if _, err := db.ExecContext(ctx, outboxSchema); err != nil {
		return nil, fmt.Errorf("whatsapp outbox: %w", err)
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Outbox{db: db, logger: logger, now: time.Now}, nil
}

// Close closes the file.
func (o *Outbox) Close() error { return o.db.Close() }

// Put keeps a message, once per key, and drops the oldest past OutboxMax.
func (o *Outbox) Put(ctx context.Context, message domain.Inbound) error {
	body, err := json.Marshal(message)
	if err != nil {
		return err
	}
	if _, err := o.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO opp_whatsapp_outbox (key, body, created_at) VALUES (?, ?, ?)`,
		message.Key, string(body), o.now().UnixMilli()); err != nil {
		return err
	}
	result, err := o.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_outbox WHERE seq <= (
		SELECT seq FROM opp_whatsapp_outbox ORDER BY seq DESC LIMIT 1 OFFSET ?)`, domain.OutboxMax)
	if err != nil {
		return err
	}
	if dropped, _ := result.RowsAffected(); dropped > 0 {
		o.logger.Warn("whatsapp: the outbox is full; the oldest messages were dropped",
			slog.Int64("dropped", dropped), slog.Int("kept", domain.OutboxMax))
	}
	return nil
}

// Pending is up to limit messages, oldest first.
func (o *Outbox) Pending(ctx context.Context, limit int) ([]domain.Inbound, error) {
	rows, err := o.db.QueryContext(ctx, `SELECT body FROM opp_whatsapp_outbox ORDER BY seq LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []domain.Inbound
	for rows.Next() {
		var body string
		if err := rows.Scan(&body); err != nil {
			return nil, err
		}
		var message domain.Inbound
		if err := json.Unmarshal([]byte(body), &message); err != nil {
			// A row this version cannot read is not one the link can carry.
			o.logger.Warn("whatsapp: an unreadable outbox row was skipped", slog.Any("error", err))
			continue
		}
		out = append(out, message)
	}
	return out, rows.Err()
}

// Ack forgets the messages under keys.
func (o *Outbox) Ack(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	args := make([]any, len(keys))
	for i, key := range keys {
		args[i] = key
	}
	marks := strings.TrimSuffix(strings.Repeat("?,", len(keys)), ",")
	// Only placeholders are joined into the statement; the keys are bound.
	_, err := o.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_outbox WHERE key IN (`+marks+`)`, args...) //nolint:gosec // placeholders only
	return err
}

// Clear forgets every message waiting.
func (o *Outbox) Clear(ctx context.Context) error {
	_, err := o.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_outbox`)
	return err
}
