package link_test

import (
	"bytes"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

func TestFrameIsBigEndianIdThenBytes(t *testing.T) {
	frame := link.EncodeFrame(0x01020304, []byte("hi"))
	if !bytes.Equal(frame, []byte{1, 2, 3, 4, 'h', 'i'}) {
		t.Fatalf("frame = %v", frame)
	}
	id, body, ok := link.DecodeFrame(frame)
	if !ok || id != 0x01020304 || string(body) != "hi" {
		t.Fatalf("decoded %d %q %v", id, body, ok)
	}
	if _, _, ok := link.DecodeFrame([]byte{0, 0, 1}); ok {
		t.Fatal("a short frame must be dropped")
	}
}

func TestIsCommandIDAcceptsOnlyAUUID(t *testing.T) {
	for id, want := range map[string]bool{
		"0b6f3f7e-5a3c-4c8e-9a4f-2f1d8c9b7a61":    true,
		"../../.ssh/authorized_keys":              false,
		"0b6f3f7e-5a3c-4c8e-9a4f-2f1d8c9b7a61/..": false,
		"": false,
	} {
		if got := link.IsCommandID(id); got != want {
			t.Fatalf("IsCommandID(%q) = %v, want %v", id, got, want)
		}
	}
}
