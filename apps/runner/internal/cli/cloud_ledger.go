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

// cloudStart is one remembered start: the cloud session `claude --cloud` or
// the task `codex cloud exec` made for an Oppenheimer session, and when.
type cloudStart struct {
	ID    string    `json:"id"`
	URL   string    `json:"url"`
	Title string    `json:"title,omitempty"`
	At    time.Time `json:"at"`
	// Agent is the catalog id that started it; empty is Claude Code, from
	// before Codex could be started.
	Agent string `json:"agent,omitempty"`
	// Status is a Codex task's status as last reported to the control plane
	// (cloud.CodexPending and the rest); empty until the first report. Claude
	// Code's cloud gives the host none.
	Status string `json:"status,omitempty"`
}

// codexWatch is a Codex task whose status is still owed to the control
// plane, by the Oppenheimer session it was started for.
type codexWatch struct {
	SessionID string
	TaskID    string
	Status    string
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

// record remembers the cloud session agent started for sessionID, keeping
// the newest cloudLedgerCap.
func (l cloudLedger) record(sessionID, agent string, started cloud.Started, at time.Time) error {
	cloudLedgerMu.Lock()
	defer cloudLedgerMu.Unlock()
	entries, err := l.read()
	if err != nil {
		entries = map[string]cloudStart{}
	}
	entry := cloudStart{ID: started.ID, URL: started.URL, Title: started.Title, At: at}
	if agent != claudeCloudAgent {
		entry.Agent = agent
	}
	entries[sessionID] = entry
	return l.write(entries)
}

// codexUnsettled is the Codex tasks started since `since` whose last
// reported status could still change: the ones the status poll asks about.
func (l cloudLedger) codexUnsettled(since time.Time) []codexWatch {
	cloudLedgerMu.Lock()
	defer cloudLedgerMu.Unlock()
	entries, _ := l.read()
	var out []codexWatch
	for sessionID, entry := range entries {
		if entry.Agent != codexCloudAgent || cloud.CodexSettled(entry.Status) || entry.At.Before(since) {
			continue
		}
		out = append(out, codexWatch{SessionID: sessionID, TaskID: entry.ID, Status: entry.Status})
	}
	sort.Slice(out, func(a, b int) bool { return out[a].SessionID < out[b].SessionID })
	return out
}

// reported remembers that status was reported for sessionID's task, so the
// next poll reports only a change.
func (l cloudLedger) reported(sessionID, status string) error {
	cloudLedgerMu.Lock()
	defer cloudLedgerMu.Unlock()
	entries, err := l.read()
	if err != nil {
		return err
	}
	entry, ok := entries[sessionID]
	if !ok {
		return nil
	}
	entry.Status = status
	entries[sessionID] = entry
	return l.write(entries)
}

// write keeps the newest cloudLedgerCap of entries and replaces the file with
// them. The caller holds cloudLedgerMu.
func (l cloudLedger) write(entries map[string]cloudStart) error {
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
