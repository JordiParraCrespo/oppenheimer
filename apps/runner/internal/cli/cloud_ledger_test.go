package cli

import (
	"fmt"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
)

func TestCloudLedgerRemembersAStartAcrossProcesses(t *testing.T) {
	dir := t.TempDir()
	started := cloud.Started{ID: "session_01abcdefgh", URL: "https://claude.ai/code/session_01abcdefgh", Title: "Fix it"}
	if err := newCloudLedger(dir).record("s-1", started, time.Now()); err != nil {
		t.Fatalf("record: %v", err)
	}

	// A new ledger over the same directory: the runner after a restart.
	got, ok := newCloudLedger(dir).find("s-1")
	if !ok || got != started {
		t.Fatalf("find = %+v, %v; want %+v", got, ok, started)
	}
	if _, ok := newCloudLedger(dir).find("s-2"); ok {
		t.Fatal("found a start that was never recorded")
	}
}

func TestCloudLedgerKeepsTheNewest(t *testing.T) {
	ledger := newCloudLedger(t.TempDir())
	base := time.Now()
	for i := range cloudLedgerCap + 5 {
		id := fmt.Sprintf("s-%d", i)
		if err := ledger.record(id, cloud.Started{ID: "session_0" + id}, base.Add(time.Duration(i)*time.Second)); err != nil {
			t.Fatalf("record %s: %v", id, err)
		}
	}
	if _, ok := ledger.find("s-0"); ok {
		t.Fatal("kept the oldest start past the cap")
	}
	if _, ok := ledger.find(fmt.Sprintf("s-%d", cloudLedgerCap+4)); !ok {
		t.Fatal("dropped the newest start")
	}
}
