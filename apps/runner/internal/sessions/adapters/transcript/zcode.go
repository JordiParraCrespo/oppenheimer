package transcript

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"slices"
	"sync"
	"time"

	// ZCode's database is SQLite; this driver is pure Go, as the runner is.
	_ "modernc.org/sqlite"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// ZCode (`zai-org/ZCode`) keeps every conversation in one SQLite database,
// `~/.zcode/cli/db/db.sqlite`, in OpenCode's shapes: a `session` row per
// conversation, a `message` row per message and a `part` row per part, each
// with its JSON in `data`. So the chat reads it with OpenCode's follower
// (opencode.go), over this store instead of OpenCode's API. Its guide calls
// the tables an implementation detail: this reads the few columns the
// follower needs and nothing else, opens the file read-only, and a ZCode
// whose tables moved reads as a store that cannot be read, which the
// follower retries, until this is changed to match.
//
// ZCode writes messages the person never sees beside theirs (its
// environment, the date, reminders), marked model-only; they are left out.
//
// What it costs ZCode: two reads of its database every openCodePollEvery,
// only while a browser is attached, on a connection of its own that never
// writes.

// zcodeStore is the conversations in one ZCode database.
type zcodeStore struct {
	path string

	once sync.Once
	db   *sql.DB
	err  error
}

var _ openCodeStore = (*zcodeStore)(nil)

// followZCode follows the session's conversation in ZCode's database until
// ctx ends: the newest root conversation in its directory touched since it
// launched, which a restart (a fresh ZCode, since it reopens none) moves to.
func followZCode(ctx context.Context, path string, since int64, directory string, entryMax, batchMax int, emit func(app.ChatBatch) error) {
	store := &zcodeStore{path: path}
	defer store.close()
	for {
		_ = newOpenCodeFollower(store, since, directory, entryMax, batchMax, emit).run(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(openCodeRetryEvery):
		}
	}
}

// open is the database, opened read-only on first use. A database that is
// not there yet is no error: ZCode makes it on its first conversation.
func (s *zcodeStore) open() (*sql.DB, error) {
	if _, err := os.Stat(s.path); errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	s.once.Do(func() {
		s.db, s.err = sql.Open("sqlite", "file:"+s.path+"?mode=ro&_pragma=busy_timeout(2000)&_pragma=query_only(1)")
		if s.err == nil {
			s.db.SetMaxOpenConns(1)
		}
	})
	return s.db, s.err
}

func (s *zcodeStore) close() {
	if s.db != nil {
		_ = s.db.Close()
	}
}

func (s *zcodeStore) sessions(ctx context.Context, directory string) ([]openCodeSession, error) {
	db, err := s.open()
	if db == nil || err != nil {
		return nil, err
	}
	query := `SELECT id, COALESCE(parent_id, ''), directory, time_updated FROM session WHERE time_deleted IS NULL AND time_archived IS NULL`
	var args []any
	if directory != "" {
		query += ` AND directory = ?`
		args = append(args, directory)
	}
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var sessions []openCodeSession
	for rows.Next() {
		var row openCodeSession
		if err := rows.Scan(&row.ID, &row.ParentID, &row.Directory, &row.Time.Updated); err != nil {
			return nil, err
		}
		sessions = append(sessions, row)
	}
	return sessions, rows.Err()
}

// zcodeMessage is a `message` row's data: OpenCode's message head, and the
// marks that say whether the person sees it.
type zcodeMessage struct {
	openCodeInfo
	Metadata struct {
		Visibility string `json:"visibility"`
	} `json:"metadata"`
	Semantics struct {
		UIVisibility string `json:"uiVisibility"`
	} `json:"semantics"`
}

// hidden is a message ZCode writes for the model alone.
func (m zcodeMessage) hidden() bool {
	return m.Metadata.Visibility == "model-only" || m.Semantics.UIVisibility == "hidden"
}

func (s *zcodeStore) messages(ctx context.Context, session string, limit int) ([]openCodeMessage, error) {
	db, err := s.open()
	if db == nil || err != nil {
		return nil, err
	}
	// The model-only messages are left out here rather than after the read,
	// so a window of limit counts only what the person sees: ZCode writes
	// several of them a turn, and a window of its last rows that held few
	// shown ones would read as the whole conversation.
	query := `SELECT id, data, time_created FROM message WHERE session_id = ?
		AND COALESCE(json_extract(data, '$.metadata.visibility'), '') <> 'model-only'
		AND COALESCE(json_extract(data, '$.semantics.uiVisibility'), '') <> 'hidden'
		ORDER BY time_created DESC, id DESC`
	args := []any{session}
	if limit > 0 {
		query += ` LIMIT ?`
		args = append(args, limit)
	}
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	var messages []openCodeMessage
	byID := map[string]int{}
	// oldest is the earliest message read: no part of the messages kept was
	// written before it.
	oldest := int64(0)
	for rows.Next() {
		var id, data string
		var created int64
		if err := rows.Scan(&id, &data, &created); err != nil {
			_ = rows.Close()
			return nil, err
		}
		oldest = created
		var head zcodeMessage
		if json.Unmarshal([]byte(data), &head) != nil || head.hidden() {
			continue
		}
		head.ID = id
		byID[id] = len(messages)
		messages = append(messages, openCodeMessage{Info: head.openCodeInfo})
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, err
	}
	_ = rows.Close()
	slices.Reverse(messages)
	for id, i := range byID {
		byID[id] = len(messages) - 1 - i
	}
	if len(messages) == 0 {
		return messages, nil
	}
	if err := s.readParts(ctx, db, session, oldest, messages, byID); err != nil {
		return nil, err
	}
	return messages, nil
}

// readParts fills in each message's parts, in the order ZCode wrote them:
// the conversation's parts written since oldest, kept for the messages read.
func (s *zcodeStore) readParts(ctx context.Context, db *sql.DB, session string, oldest int64, messages []openCodeMessage, byID map[string]int) error {
	rows, err := db.QueryContext(ctx,
		`SELECT message_id, id, data FROM part WHERE session_id = ? AND time_created >= ? ORDER BY COALESCE(sequence, 0), time_created, id`,
		session, oldest)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var message, id, data string
		if err := rows.Scan(&message, &id, &data); err != nil {
			return err
		}
		var part openCodePart
		if json.Unmarshal([]byte(data), &part) != nil {
			continue
		}
		part.ID = id
		if i, ok := byID[message]; ok {
			messages[i].Parts = append(messages[i].Parts, part)
		}
	}
	return rows.Err()
}

// events says nothing: ZCode's database has no stream, so the follower reads
// it on its poll.
func (s *zcodeStore) events(ctx context.Context, _ func(string)) error {
	<-ctx.Done()
	return ctx.Err()
}
