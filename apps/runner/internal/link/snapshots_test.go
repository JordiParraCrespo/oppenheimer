package link_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

// snapshots builds n live sessions as heavy as the schema lets a real one
// be: three windows with 200-character names and a vendor login URL.
func snapshots(n int) []link.SessionSnapshot {
	out := make([]link.SessionSnapshot, n)
	for i := range out {
		login := "https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&state=" + strings.Repeat("s", 64)
		agentSession := fmt.Sprintf("agent-%032d", i)
		out[i] = link.SessionSnapshot{
			SessionID: fmt.Sprintf("00000000-0000-4000-8000-%012d", i),
			Agent:     "claude-code", Observed: "blocked", StateSeconds: 86_400,
			Windows: []link.Window{
				{Index: 0, Name: strings.Repeat("a", 200)},
				{Index: 1, Name: strings.Repeat("b", 200)},
				{Index: 2, Name: strings.Repeat("c", 200)},
			},
			AgentSessionID: &agentSession, LoginURL: &login,
		}
	}
	return out
}

func helloWith(sessions []link.SessionSnapshot) link.Hello {
	return link.Hello{
		Type: "hello", RunnerVersion: "0.4.1", RunID: "run-1",
		Protocol: link.Range{Min: link.ProtocolVersion, Max: link.ProtocolVersion},
		Host:     hostdomain.Facts{Platform: "linux", Arch: "amd64", Tools: []hostdomain.Tool{}},
		Sessions: sessions, Capabilities: []string{link.CapabilitySessionImage},
	}
}

func encodedSize(t *testing.T, v any) int {
	t.Helper()
	body, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return len(body)
}

func ids(sessions []link.SessionSnapshot) map[string]bool {
	out := make(map[string]bool, len(sessions))
	for _, s := range sessions {
		out[s.SessionID] = true
	}
	return out
}

func TestAHelloThatFitsIsSentAsBuilt(t *testing.T) {
	hello, fit, held := link.FitHello(helloWith(snapshots(10)))
	if fit != link.FitFull || held != 10 || len(hello.Sessions) != 10 {
		t.Fatalf("fit=%s held=%d sent=%d; want every snapshot as built", fit, held, len(hello.Sessions))
	}
	if hello.Sessions[0].LoginURL == nil || hello.Sessions[0].Windows[2].Name == "" {
		t.Fatal("a hello that fits lost detail")
	}
}

// Past what the frame holds in full, every session is still listed — the
// hello's reconciliation records a session it leaves out as stopped — and
// each carries only its required fields.
func TestAHelloTooLargeInFullListsEverySessionCompact(t *testing.T) {
	const n = 2_000
	full := helloWith(snapshots(n))
	if size := encodedSize(t, full); size <= link.MaxFrameBytes {
		t.Fatalf("the full hello is %d bytes; the test needs one over %d", size, link.MaxFrameBytes)
	}

	hello, fit, held := link.FitHello(full)

	if fit != link.FitCompact || held != n {
		t.Fatalf("fit=%s held=%d; want compact", fit, held)
	}
	if size := encodedSize(t, hello); size > link.MaxFrameBytes {
		t.Fatalf("the fitted hello is %d bytes, over the %d cap", size, link.MaxFrameBytes)
	}
	if got := ids(hello.Sessions); len(got) != n {
		t.Fatalf("the compact hello lists %d sessions, want all %d", len(got), n)
	}
	s := hello.Sessions[0]
	if s.Windows == nil || len(s.Windows) != 0 || s.LoginURL != nil || s.AgentSessionID != nil {
		t.Fatalf("a compact snapshot kept optional detail: %+v", s)
	}
	if s.Agent != "claude-code" || s.Observed != "blocked" || s.StateSeconds != 86_400 {
		t.Fatalf("a compact snapshot lost a required field: %+v", s)
	}
	// Windows must encode as [] — the schema takes an array, never null.
	if body, _ := json.Marshal(s); !strings.Contains(string(body), `"windows":[]`) {
		t.Fatalf("compact windows encode as %s", body)
	}
}

// Past what even compact snapshots fit, the hello still goes — the host keeps
// its link — with as many sessions as fit, in the handler's order.
func TestAHelloTooLargeEvenCompactIsTruncatedToTheCap(t *testing.T) {
	const n = 10_000
	hello, fit, held := link.FitHello(helloWith(snapshots(n)))

	if fit != link.FitTruncated || held != n {
		t.Fatalf("fit=%s held=%d; want truncated", fit, held)
	}
	size := encodedSize(t, hello)
	if size > link.MaxFrameBytes {
		t.Fatalf("the fitted hello is %d bytes, over the %d cap", size, link.MaxFrameBytes)
	}
	sent := len(hello.Sessions)
	if sent == 0 || sent >= n {
		t.Fatalf("sent %d of %d sessions", sent, n)
	}
	// Tight: one more compact snapshot would not have fitted.
	if slack := link.MaxFrameBytes - size; slack > encodedSize(t, hello.Sessions[0])+1 {
		t.Fatalf("%d bytes left unused; the truncation is not tight", slack)
	}
	for i, s := range hello.Sessions {
		if want := fmt.Sprintf("00000000-0000-4000-8000-%012d", i); s.SessionID != want {
			t.Fatalf("session %d is %s, want %s: the handler's order", i, s.SessionID, want)
		}
	}
	t.Logf("a compact hello carries %d sessions", sent)
}

func TestAHeartbeatIsFittedTheSameWay(t *testing.T) {
	beat := link.Heartbeat{
		Type: "heartbeat", Channel: "stable", Host: hostdomain.Facts{Platform: "linux"},
		Sessions: snapshots(10_000),
	}
	fitted, fit, _ := link.FitHeartbeat(beat)
	if fit != link.FitTruncated {
		t.Fatalf("fit=%s, want truncated", fit)
	}
	if size := encodedSize(t, fitted); size > link.MaxFrameBytes {
		t.Fatalf("the fitted heartbeat is %d bytes, over the %d cap", size, link.MaxFrameBytes)
	}
}

// bigHost says hello with more sessions than a frame holds in full.
type bigHost struct {
	recorder
	sessions int
}

func (h *bigHost) Hello(ctx context.Context) (link.Hello, error) {
	hello, _ := h.recorder.Hello(ctx)
	hello.Sessions = snapshots(h.sessions)
	return hello, nil
}

// End to end: the host with more sessions than a full hello holds still gets
// its link, and the control plane hears every session it holds.
func TestAHostWithThousandsOfSessionsStillConnects(t *testing.T) {
	cp := newControlPlane(t)
	host := &bigHost{sessions: 2_000}
	c := client(t, cp, host, "token")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)

	var hello link.Hello
	select {
	case hello = <-cp.hellos:
	case <-time.After(5 * time.Second):
		t.Fatal("the control plane never read a hello")
	}
	eventually(t, "link", c.Live)
	if got := ids(hello.Sessions); len(got) != host.sessions {
		t.Fatalf("the control plane heard %d sessions, want %d", len(got), host.sessions)
	}
}
