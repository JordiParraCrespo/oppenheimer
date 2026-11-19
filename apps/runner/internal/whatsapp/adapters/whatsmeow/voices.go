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

// voiceSchema keeps, per voice note, the serialized whatsmeow AudioMessage:
// its media key, hashes and path on WhatsApp's media servers, which is what
// downloading it takes. The audio itself is never written here.
const voiceSchema = `CREATE TABLE IF NOT EXISTS opp_whatsapp_voice (
	key        TEXT PRIMARY KEY,
	ref        BLOB NOT NULL,
	seconds    INTEGER NOT NULL,
	size       INTEGER NOT NULL,
	created_at INTEGER NOT NULL
)`

// Voices is app.VoiceNotes over a table of the store's file.
type Voices struct {
	db  *sql.DB
	now func() time.Time
}

var _ app.VoiceNotes = (*Voices)(nil)

func newVoices(ctx context.Context, db *sql.DB) (*Voices, error) {
	if _, err := db.ExecContext(ctx, voiceSchema); err != nil {
		return nil, fmt.Errorf("whatsapp voice notes: %w", err)
	}
	return &Voices{db: db, now: time.Now}, nil
}

// Keep keeps a voice note once per chat and id, then forgets those past
// domain.VoiceNoteKept and the oldest beyond domain.VoiceNotesKeptMax.
func (v *Voices) Keep(ctx context.Context, chatID, id string, voice domain.Voice) error {
	now := v.now()
	if _, err := v.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO opp_whatsapp_voice (key, ref, seconds, size, created_at) VALUES (?, ?, ?, ?, ?)`,
		domain.KeyOf(chatID, id), voice.Ref, voice.Seconds, int64(voice.Size), now.UnixMilli()); err != nil { //nolint:gosec // a WhatsApp file length, far below int64's range
		return err
	}
	if _, err := v.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_voice WHERE created_at < ?`,
		now.Add(-domain.VoiceNoteKept).UnixMilli()); err != nil {
		return err
	}
	_, err := v.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_voice WHERE key IN (
		SELECT key FROM opp_whatsapp_voice ORDER BY created_at DESC LIMIT -1 OFFSET ?)`, domain.VoiceNotesKeptMax)
	return err
}

// Find is the voice note under chat and id, unless it is past domain.VoiceNoteKept.
func (v *Voices) Find(ctx context.Context, chatID, id string) (domain.Voice, bool, error) {
	var voice domain.Voice
	var size int64
	err := v.db.QueryRowContext(ctx,
		`SELECT ref, seconds, size FROM opp_whatsapp_voice WHERE key = ? AND created_at >= ?`,
		domain.KeyOf(chatID, id), v.now().Add(-domain.VoiceNoteKept).UnixMilli(),
	).Scan(&voice.Ref, &voice.Seconds, &size)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Voice{}, false, nil
	}
	if err != nil {
		return domain.Voice{}, false, err
	}
	voice.Size = uint64(size) //nolint:gosec // written from a uint64 by Keep
	return voice, true, nil
}

// ClearVoiceNotes forgets every voice note.
func (v *Voices) ClearVoiceNotes(ctx context.Context) error {
	_, err := v.db.ExecContext(ctx, `DELETE FROM opp_whatsapp_voice`)
	return err
}
