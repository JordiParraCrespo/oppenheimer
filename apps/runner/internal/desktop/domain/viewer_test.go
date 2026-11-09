package domain_test

import (
	"bytes"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

// handshake plays noVNC's side of the handshake against v and returns what
// reached the server: the ClientInit.
func handshake(t *testing.T, v *domain.Viewer) []byte {
	t.Helper()
	if got := string(v.Greeting()); got != "RFB 003.008\n" {
		t.Fatalf("greeting = %q", got)
	}
	answer, forward, err := v.Feed([]byte("RFB 003.008\n"))
	if err != nil || !bytes.Equal(answer, []byte{1, 1}) || len(forward) != 0 {
		t.Fatalf("after the version: answer %v forward %v err %v; want one type, None", answer, forward, err)
	}
	answer, forward, err = v.Feed([]byte{1})
	if err != nil || !bytes.Equal(answer, []byte{0, 0, 0, 0}) || len(forward) != 0 {
		t.Fatalf("after None: answer %v forward %v err %v; want success", answer, forward, err)
	}
	// An exclusive ClientInit (0) would disconnect everyone else watching.
	_, forward, err = v.Feed([]byte{0})
	if err != nil {
		t.Fatal(err)
	}
	return forward
}

var (
	updateRequest = []byte{3, 0, 0, 0, 0, 0, 0x04, 0, 0x03, 0}
	pointerClick  = []byte{5, 1, 0, 10, 0, 20}
	keyDown       = []byte{4, 1, 0, 0, 0, 0, 0, 0x61}
)

func TestViewerOffersNoPasswordAndForcesASharedSession(t *testing.T) {
	if init := handshake(t, domain.NewViewer(false)); !bytes.Equal(init, []byte{1}) {
		t.Fatalf("ClientInit forwarded = %v, want shared (1)", init)
	}
}

func TestWatchingDropsInputButStillAsksForTheScreen(t *testing.T) {
	v := domain.NewViewer(false)
	handshake(t, v)
	stream := append(append(append([]byte{}, pointerClick...), updateRequest...), keyDown...)
	_, forward, err := v.Feed(stream)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(forward, updateRequest) {
		t.Fatalf("forwarded %v, want only the update request", forward)
	}
}

func TestTakingControlForwardsInputAndGivingItBackStopsIt(t *testing.T) {
	v := domain.NewViewer(false)
	handshake(t, v)
	v.SetControl(true)
	if _, forward, _ := v.Feed(pointerClick); !bytes.Equal(forward, pointerClick) {
		t.Fatalf("in control, forwarded %v", forward)
	}
	v.SetControl(false)
	if _, forward, _ := v.Feed(keyDown); len(forward) != 0 {
		t.Fatalf("watching again, forwarded %v", forward)
	}
}

func TestAMessageSplitAcrossFramesIsJudgedWhole(t *testing.T) {
	// A frame boundary inside a pointer event must not let its tail through.
	v := domain.NewViewer(false)
	handshake(t, v)
	for _, piece := range [][]byte{pointerClick[:2], pointerClick[2:], updateRequest[:4]} {
		if _, forward, _ := v.Feed(piece); len(forward) != 0 {
			t.Fatalf("forwarded %v before a whole message", forward)
		}
	}
	if _, forward, _ := v.Feed(updateRequest[4:]); !bytes.Equal(forward, updateRequest) {
		t.Fatalf("forwarded %v, want the update request whole", forward)
	}
}

func TestWatchingDropsAClipboardPasteOfAnyLength(t *testing.T) {
	v := domain.NewViewer(false)
	handshake(t, v)
	paste := append([]byte{6, 0, 0, 0, 0, 0, 0, 5}, "hello"...)
	if _, forward, err := v.Feed(append(paste, updateRequest...)); err != nil || !bytes.Equal(forward, updateRequest) {
		t.Fatalf("forwarded %v err %v", forward, err)
	}
}

func TestAnUnknownMessageEndsTheStream(t *testing.T) {
	// Unknown means its length is unknown, and every byte after it unframed.
	v := domain.NewViewer(true)
	handshake(t, v)
	if _, _, err := v.Feed([]byte{99, 0, 0}); !errors.Is(err, domain.ErrBrowser) {
		t.Fatalf("err = %v, want ErrBrowser", err)
	}
}
