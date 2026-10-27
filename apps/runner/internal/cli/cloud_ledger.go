package cli

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
)

// cloudLedgerFile is where a host remembers the cloud sessions it started,
// in the runner's state directory.
const cloudLedgerFile = "cloud-starts.json"

// cloudLedgerCap bounds the file: a create sent again comes within minutes,
// so only the newest starts need remembering.
const cloudLedgerCap = 500

// cloudLedgerMu serialises the read-modify-write of the file across the
// handler's lanes.
var cloudLedgerMu sync.Mutex

// cloudStart is one remembered start: the cloud session `claude --cloud` made
// for an Oppenheimer session, and when.
type cloudStart struct {
	ID    string    `json:"id"`
	URL   string    `json:"url"`
	Title string    `json:"title,omitempty"`
	At    time.Time `json:"at"`
}

// cloudLedger is the cloud sessions this host started, by Oppenheimer session
// id, on disk. A start whose `session.started` never reached the control plane
// (the link was down, then the runner restarted) is sent its create again by
// the next hello; the ledger is what lets that create report the session the
// first one made instead of starting a second.
type cloudLedger struct {
	path string
}

func newCloudLedger(stateDir string) cloudLedger {
	return cloudLedger{path: filepath.Join(stateDir, cloudLedgerFile)}
}

// find answers the cloud session started for sessionID, if one was.
func (l cloudLedger) find(sessionID string) (cloud.Started, bool) {
	cloudLedgerMu.Lock()
	defer cloudLedgerMu.Unlock()
	entries, _ := l.read()
	entry, ok := entries[sessionID]
	if !ok {
		return cloud.Started{}, false
	}
	return cloud.Started{ID: entry.ID, URL: entry.URL, Title: entry.Title}, true
}

// record remembers the cloud session started for sessionID, keeping the
// newest cloudLedgerCap.
func (l cloudLedger) record(sessionID string, started cloud.Started, at time.Time) error {
	cloudLedgerMu.Lock()
	defer cloudLedgerMu.Unlock()
	entries, err := l.read()
	if err != nil {
		entries = map[string]cloudStart{}
	}
	entries[sessionID] = cloudStart{ID: started.ID, URL: started.URL, Title: started.Title, At: at}
	if len(entries) > cloudLedgerCap {
		ids := make([]string, 0, len(entries))
		for id := range entries {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(a, b int) bool { return entries[ids[a]].At.After(entries[ids[b]].At) })
		for _, id := range ids[cloudLedgerCap:] {
			delete(entries, id)
		}
	}
	raw, err := json.Marshal(entries)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(l.path), 0o700); err != nil {
		return err
	}
	// Written beside and renamed over, so a crash leaves the old file or the new one.
	tmp := l.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, l.path)
}

func (l cloudLedger) read() (map[string]cloudStart, error) {
	entries := map[string]cloudStart{}
	raw, err := os.ReadFile(l.path)
	if errors.Is(err, fs.ErrNotExist) {
		return entries, nil
	}
	if err != nil {
		return entries, err
	}
	if err := json.Unmarshal(raw, &entries); err != nil {
		return map[string]cloudStart{}, err
	}
	return entries, nil
}
