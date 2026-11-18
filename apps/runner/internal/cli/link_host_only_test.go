package cli

import (
	"context"
	"testing"
	"time"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A session the host minted itself (a child from `runner sessions run`, one
// from `runner sessions create`) stays out of the hello and every heartbeat.
// The regression: three review children on a host got their 12-character ids
// into the hello, the control plane refused the whole hello as not naming
// UUIDs, and the host stayed offline until they were closed by hand.
func TestTheHelloLeavesOutSessionsTheHostMintedItself(t *testing.T) {
	p := newPlacesHarness(t, t.TempDir(), "acct")
	openFolderSession(t, p)

	hostOnly, err := p.svc.Create(context.Background(), sessionsapp.CreateInput{
		Folder: "/home/jordi/code/site", Agent: sessionsdomain.AgentShell,
	})
	if err != nil {
		t.Fatal(err)
	}
	if sessionsdomain.KnownToControlPlane(hostOnly.ID) {
		t.Fatalf("a host-minted id %q passed for the control plane's", hostOnly.ID)
	}
	for deadline := time.Now().Add(2 * time.Second); ; {
		got, err := p.svc.Get(hostOnly.ID)
		if err == nil && got.State.Live() {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the host-only session never went live: %+v (err %v)", got.State, err)
		}
		time.Sleep(time.Millisecond)
	}

	snapshots := p.h.snapshots()
	if len(snapshots) != 1 || snapshots[0].SessionID != sessionUnderTest {
		t.Fatalf("snapshots = %+v, want only %s", snapshots, sessionUnderTest)
	}
}
