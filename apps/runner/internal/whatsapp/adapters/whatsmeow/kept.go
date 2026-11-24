package whatsmeow

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/domain"
)

// keptSchema keeps, per voice note or image, the serialized whatsmeow
// message (AudioMessage or ImageMessage): its media key, hashes and path on
// WhatsApp's media servers, which is what downloading it takes. The bytes
// themselves are never written here. One table per kind, so a ref is always
// read back as the message it was written from.
const keptSchema = `CREATE TABLE IF NOT EXISTS %s (
	key        TEXT PRIMARY KEY,
	ref        BLOB NOT NULL,
	seconds    INTEGER NOT NULL,
	size       INTEGER NOT NULL,
	created_at INTEGER NOT NULL
)`

const (
	voiceTable = "opp_whatsapp_voice"
	imageTable = "opp_whatsapp_image"
)

// kept is one kind of fetchable media over a table of the store's file. Its
// statements are written once, for its own table, so no query is put
// together where it runs.
type kept struct {
	db  *sql.DB
	now func() time.Time
	sql keptStatements
}

type keptStatements struct {
	insert, expire, trim, find, clear string
}

func newKept(ctx context.Context, db *sql.DB, table string) (kept, error) {
	if _, err := db.ExecContext(ctx, fmt.Sprintf(keptSchema, table)); err != nil {
		return kept{}, fmt.Errorf("whatsapp %s: %w", table, err)
	}
	named := strings.NewReplacer("{table}", table).Replace
	return kept{db: db, now: time.Now, sql: keptStatements{
		insert: named(`INSERT OR IGNORE INTO {table} (key, ref, seconds, size, created_at) VALUES (?, ?, ?, ?, ?)`),
		expire: named(`DELETE FROM {table} WHERE created_at < ?`),
		trim:   named(`DELETE FROM {table} WHERE key IN (SELECT key FROM {table} ORDER BY created_at DESC LIMIT -1 OFFSET ?)`),
		find:   named(`SELECT ref, seconds, size FROM {table} WHERE key = ? AND created_at >= ?`),
		clear:  named(`DELETE FROM {table}`),
	}}, nil
}

// keep keeps a ref once per chat and id, then forgets those past
// domain.MediaKept and the oldest beyond domain.MediaKeptMax.
func (k *kept) keep(ctx context.Context, chatID, id string, ref []byte, seconds int, size uint64) error {
	now := k.now()
	if _, err := k.db.ExecContext(ctx, k.sql.insert,
		domain.KeyOf(chatID, id), ref, seconds, int64(size), now.UnixMilli()); err != nil { //nolint:gosec // a WhatsApp file length, far below int64's range
		return err
	}
	if _, err := k.db.ExecContext(ctx, k.sql.expire, now.Add(-domain.MediaKept).UnixMilli()); err != nil {
		return err
	}
	_, err := k.db.ExecContext(ctx, k.sql.trim, domain.MediaKeptMax)
	return err
}

// find is the ref under chat and id, unless it is past domain.MediaKept.
func (k *kept) find(ctx context.Context, chatID, id string) (ref []byte, seconds int, size uint64, ok bool, err error) {
	var stored int64
	err = k.db.QueryRowContext(ctx, k.sql.find,
		domain.KeyOf(chatID, id), k.now().Add(-domain.MediaKept).UnixMilli(),
	).Scan(&ref, &seconds, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, 0, false, nil
	}
	if err != nil {
		return nil, 0, 0, false, err
	}
	return ref, seconds, uint64(stored), true, nil //nolint:gosec // written from a uint64 by keep
}

func (k *kept) clear(ctx context.Context) error {
	_, err := k.db.ExecContext(ctx, k.sql.clear)
	return err
}

// Kept is app.KeptMedia over the store's file: a table per kind, so a ref
// is always read back as the message it was written from.
type Kept struct {
	tables map[domain.KeptKind]*kept
}

var _ app.KeptMedia = (*Kept)(nil)

func newKeptMedia(ctx context.Context, db *sql.DB) (*Kept, error) {
	store := &Kept{tables: map[domain.KeptKind]*kept{}}
	for kind, table := range map[domain.KeptKind]string{domain.KeptVoice: voiceTable, domain.KeptImage: imageTable} {
		k, err := newKept(ctx, db, table)
		if err != nil {
			return nil, err
		}
		store.tables[kind] = &k
	}
	return store, nil
}

func (s *Kept) table(kind domain.KeptKind) (*kept, error) {
	t, ok := s.tables[kind]
	if !ok {
		return nil, fmt.Errorf("whatsapp: no kept media of kind %q", kind)
	}
	return t, nil
}

// Keep keeps media once per chat and id, in its kind's table.
func (s *Kept) Keep(ctx context.Context, chatID, id string, media domain.Kept) error {
	t, err := s.table(media.Kind)
	if err != nil {
		return err
	}
	return t.keep(ctx, chatID, id, media.Ref, media.Seconds, media.Size)
}

// Find is the media of kind under chat and id, unless it is past domain.MediaKept.
func (s *Kept) Find(ctx context.Context, kind domain.KeptKind, chatID, id string) (domain.Kept, bool, error) {
	t, err := s.table(kind)
	if err != nil {
		return domain.Kept{}, false, err
	}
	ref, seconds, size, ok, err := t.find(ctx, chatID, id)
	if !ok || err != nil {
		return domain.Kept{}, false, err
	}
	return domain.Kept{Kind: kind, Ref: ref, Seconds: seconds, Size: size}, true, nil
}

// ClearKept forgets every kept voice note and image.
func (s *Kept) ClearKept(ctx context.Context) error {
	var errs []error
	for _, t := range s.tables {
		errs = append(errs, t.clear(ctx))
	}
	return errors.Join(errs...)
}
