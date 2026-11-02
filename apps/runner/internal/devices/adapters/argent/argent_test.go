package argent

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

func jpeg(fill byte, n int) []byte {
	frame := append([]byte{0xff, 0xd8}, bytes.Repeat([]byte{fill}, n)...)
	return append(frame, 0xff, 0xd9)
}

// The simulator-server sends parts with no Content-Length, so a frame is
// whole at its end marker: reading it must not wait for the next part.
func TestScreenCutsFramesAtTheirEndMarker(t *testing.T) {
	first, second := jpeg(0x11, 70_000), jpeg(0x22, 10)
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "multipart/x-mixed-replace;boundary=NextFrame")
		for _, frame := range [][]byte{first, second} {
			_, _ = w.Write([]byte("--NextFrame\r\nContent-Type:image/jpeg\r\n\r\n"))
			_, _ = w.Write(frame)
			_, _ = w.Write([]byte("\r\n"))
			w.(http.Flusher).Flush()
			<-release
		}
	}))
	defer srv.Close()

	res, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	sc := &screen{body: res.Body, reader: newReader(res.Body), cancel: func() {}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	got, err := sc.Next(ctx)
	if err != nil || !bytes.Equal(got, first) {
		t.Fatalf("first frame: %d bytes, err %v", len(got), err)
	}
	release <- struct{}{}
	got, err = sc.Next(ctx)
	if err != nil || !bytes.Equal(got, second) {
		t.Fatalf("second frame: %d bytes, err %v", len(got), err)
	}
	close(release)
}

func TestScreenReadsAPartByItsContentLength(t *testing.T) {
	frame := jpeg(0xd9, 300) // end markers inside the image must not cut it
	stream := "--b\r\nContent-Type: image/jpeg\r\nContent-Length: " + strconv.Itoa(len(frame)) + "\r\n\r\n"
	body := io.NopCloser(bytes.NewReader(append([]byte(stream), frame...)))
	sc := &screen{body: body, reader: newReader(body), cancel: func() {}}
	got, err := sc.Next(context.Background())
	if err != nil || !bytes.Equal(got, frame) {
		t.Fatalf("got %d bytes, err %v", len(got), err)
	}
}

// The console names a session; the device is filled in here, and each input
// becomes the Argent tool that does it.
func TestControlsCallTheToolForEachInput(t *testing.T) {
	type call struct {
		tool, auth string
		args       map[string]any
	}
	var calls []call
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var args map[string]any
		_ = json.NewDecoder(r.Body).Decode(&args)
		calls = append(calls, call{tool: r.URL.Path, auth: r.Header.Get("Authorization"), args: args})
		_, _ = w.Write([]byte(`{"tapped":true}`))
	}))
	defer srv.Close()
	c := NewControls(ControlsOptions{URL: srv.URL, Token: "t0k"})
	device := domain.Device{Serial: "emulator-5556", Platform: domain.Android}
	for _, in := range []domain.Input{
		{Kind: "tap", X: 0.5, Y: 0.25},
		{Kind: "swipe", X: 0.5, Y: 0.9, ToX: 0.5, ToY: 0.1},
		{Kind: "text", Text: "hi"},
		{Kind: "button", Button: "home"},
	} {
		if err := c.Apply(context.Background(), device, in); err != nil {
			t.Fatal(err)
		}
	}
	tools := []string{"/tools/gesture-tap", "/tools/gesture-swipe", "/tools/keyboard", "/tools/button"}
	for i, got := range calls {
		if got.tool != tools[i] || got.auth != "Bearer t0k" || got.args["udid"] != "emulator-5556" {
			t.Errorf("call %d: %+v", i, got)
		}
	}
	if calls[0].args["x"] != 0.5 || calls[1].args["toY"] != 0.1 || calls[2].args["text"] != "hi" || calls[3].args["button"] != "home" {
		t.Errorf("arguments: %+v", calls)
	}
}

func TestControlsReportARefusal(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no such device", http.StatusBadRequest)
	}))
	defer srv.Close()
	err := NewControls(ControlsOptions{URL: srv.URL}).Apply(context.Background(), domain.Device{Serial: "x"}, domain.Input{Kind: "tap"})
	if err == nil {
		t.Fatal("a refused tap was reported as applied")
	}
}
