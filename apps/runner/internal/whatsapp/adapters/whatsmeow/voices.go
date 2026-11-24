package whatsmeow

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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

// kept is one kind of fetchable media over a table of the store's file.
type kept struct {
	db    *sql.DB
	table string
	now   func() time.Time
}

func newKept(ctx context.Context, db *sql.DB, table string) (kept, error) {
	if _, err := db.ExecContext(ctx, fmt.Sprintf(keptSchema, table)); err != nil {
		return kept{}, fmt.Errorf("whatsapp %s: %w", table, err)
	}
	return kept{db: db, table: table, now: time.Now}, nil
}

// keep keeps a ref once per chat and id, then forgets those past
// domain.VoiceNoteKept and the oldest beyond domain.VoiceNotesKeptMax.
func (k *kept) keep(ctx context.Context, chatID, id string, ref []byte, seconds int, size uint64) error {
	now := k.now()
	if _, err := k.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO `+k.table+` (key, ref, seconds, size, created_at) VALUES (?, ?, ?, ?, ?)`, //nolint:gosec // the table is one of two constants
		domain.KeyOf(chatID, id), ref, seconds, int64(size), now.UnixMilli()); err != nil { //nolint:gosec // a WhatsApp file length, far below int64's range
		return err
	}
	if _, err := k.db.ExecContext(ctx, `DELETE FROM `+k.table+` WHERE created_at < ?`, //nolint:gosec // the table is one of two constants
		now.Add(-domain.VoiceNoteKept).UnixMilli()); err != nil {
		return err
	}
	_, err := k.db.ExecContext(ctx, `DELETE FROM `+k.table+` WHERE key IN (
		SELECT key FROM `+k.table+` ORDER BY created_at DESC LIMIT -1 OFFSET ?)`, domain.VoiceNotesKeptMax) //nolint:gosec // the table is one of two constants
	return err
}

// find is the ref under chat and id, unless it is past domain.VoiceNoteKept.
func (k *kept) find(ctx context.Context, chatID, id string) (ref []byte, seconds int, size uint64, ok bool, err error) {
	var stored int64
	err = k.db.QueryRowContext(ctx,
		`SELECT ref, seconds, size FROM `+k.table+` WHERE key = ? AND created_at >= ?`, //nolint:gosec // the table is one of two constants
		domain.KeyOf(chatID, id), k.now().Add(-domain.VoiceNoteKept).UnixMilli(),
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
	_, err := k.db.ExecContext(ctx, `DELETE FROM `+k.table) //nolint:gosec // the table is one of two constants
	return err
}

// Voices is app.VoiceNotes over a table of the store's file.
type Voices struct{ kept }

var _ app.VoiceNotes = (*Voices)(nil)

func newVoices(ctx context.Context, db *sql.DB) (*Voices, error) {
	k, err := newKept(ctx, db, voiceTable)
	if err != nil {
		return nil, err
	}
	return &Voices{k}, nil
}

// Keep keeps a voice note once per chat and id.
func (v *Voices) Keep(ctx context.Context, chatID, id string, voice domain.Voice) error {
	return v.keep(ctx, chatID, id, voice.Ref, voice.Seconds, voice.Size)
}

// Find is the voice note under chat and id, unless it is past domain.VoiceNoteKept.
func (v *Voices) Find(ctx context.Context, chatID, id string) (domain.Voice, bool, error) {
	ref, seconds, size, ok, err := v.find(ctx, chatID, id)
	if !ok || err != nil {
		return domain.Voice{}, false, err
	}
	return domain.Voice{Ref: ref, Seconds: seconds, Size: size}, true, nil
}

// ClearVoiceNotes forgets every voice note.
func (v *Voices) ClearVoiceNotes(ctx context.Context) error { return v.clear(ctx) }

// Images is app.Images over a table of the store's file.
type Images struct{ kept }

var _ app.Images = (*Images)(nil)

func newImages(ctx context.Context, db *sql.DB) (*Images, error) {
	k, err := newKept(ctx, db, imageTable)
	if err != nil {
		return nil, err
	}
	return &Images{k}, nil
}

// KeepImage keeps an image once per chat and id.
func (i *Images) KeepImage(ctx context.Context, chatID, id string, image domain.Image) error {
	return i.keep(ctx, chatID, id, image.Ref, 0, image.Size)
}

// FindImage is the image under chat and id, unless it is past domain.VoiceNoteKept.
func (i *Images) FindImage(ctx context.Context, chatID, id string) (domain.Image, bool, error) {
	ref, _, size, ok, err := i.find(ctx, chatID, id)
	if !ok || err != nil {
		return domain.Image{}, false, err
	}
	return domain.Image{Ref: ref, Size: size}, true, nil
}

// ClearImages forgets every image.
func (i *Images) ClearImages(ctx context.Context) error { return i.clear(ctx) }
