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
