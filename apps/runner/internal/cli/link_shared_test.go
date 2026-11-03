package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// sharingHarness is a linked folder session whose agent can run
// `runner sessions send-file` against the daemon's local socket.
type sharingHarness struct {
	*placesHarness
	delegation Delegation
	work       string
}

func newSharingHarness(t *testing.T) sharingHarness {
	t.Helper()
	p := newPlacesHarness(t, t.TempDir(), "acct")
	p.h.app.Paths = Paths{Home: t.TempDir()}
	session := openFolderSession(t, p)
	p.svc.SetPublisher(p.h)

	socket := filepath.Join(t.TempDir(), "runner.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: p.h.app.localRouter("", slog.New(slog.NewTextHandler(io.Discard, nil)))} //nolint:gosec // a test server on a private socket
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	work := t.TempDir()
	img := image.NewRGBA(image.Rect(0, 0, 320, 200))
	for y := range 200 {
		for x := range 320 {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), uint8(x ^ y), 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(work, "home.png"), encoded.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(work, "notes.md"), []byte("# Two bugs\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	return sharingHarness{
		placesHarness: p, work: work,
		delegation: Delegation{Socket: socket, Self: session.ID, Out: &out},
	}
}

func (s sharingHarness) share(t *testing.T, name, caption string) {
	t.Helper()
	if err := s.delegation.SendFile(context.Background(), filepath.Join(s.work, name), caption); err != nil {
		t.Fatal(err)
	}
}

// sharedEvents is every `file.shared` payload the reporter sent, decoded.
func (s sharingHarness) sharedEvents(t *testing.T) []map[string]any {
	t.Helper()
	var out []map[string]any
	for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); time.Sleep(time.Millisecond) {
		out = out[:0]
		for _, event := range s.events(s.delegation.Self) {
			if event.Kind != sessionsdomain.FileSharedKind {
				continue
			}
			if strings.Contains(event.Payload, s.work) {
				t.Fatalf("the host path left the host: %s", event.Payload)
			}
			var payload map[string]any
			if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
				t.Fatal(err)
			}
			out = append(out, payload)
		}
		if len(out) > 0 {
			return out
		}
	}
	return out
}

// The regression this guards: the control plane never hears of a shared
// file, so a bot cannot name it, or hears of it with its host path (or its
// bytes) in an event the console and the bot read.
func TestASharedFileIsLoggedWithWhatItIsAndNeverWhereOrItsBytes(t *testing.T) {
	s := newSharingHarness(t)
	s.share(t, "home.png", "The home page")

	events := s.sharedEvents(t)
	if len(events) != 1 {
		t.Fatalf("file.shared sent %d times, want once", len(events))
	}
	got := events[0]
	keys := make([]string, 0, len(got))
	for key := range got {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	if !slices.Equal(keys, []string{"caption", "hasPreview", "id", "mediaType", "name", "size"}) {
		t.Fatalf("payload keys = %v", keys)
	}
	if got["name"] != "home.png" || got["mediaType"] != "image/png" || got["caption"] != "The home page" || got["hasPreview"] != true {
		t.Fatalf("payload = %v", got)
	}
}

// The regression this guards: a host that answers a preview for a session it
// does not hold, a file id it never kept, or a file it kept no preview of —
// or that answers nothing, so the bot waits out its timeout.
func TestASharedPreviewIsAnsweredOnlyForItsSessionAndAnImageItKept(t *testing.T) {
	s := newSharingHarness(t)
	s.share(t, "home.png", "")
	s.share(t, "notes.md", "")
	ids := map[string]string{}
	for deadline := time.Now().Add(2 * time.Second); len(ids) < 2 && time.Now().Before(deadline); time.Sleep(time.Millisecond) {
		for _, event := range s.sharedEvents(t) {
			ids[event["name"].(string)] = event["id"].(string)
		}
	}
	// A file another session on this host shared is not this session's.
	other, err := transcript.SaveShared(s.h.app.Paths.Files(), "9a8b7c6d-0000-4000-8000-000000000000",
		filepath.Join(s.work, "home.png"), "", time.Now())
	if err != nil {
		t.Fatal(err)
	}

	ask := func(commandID, sessionID, fileID string) {
		s.h.Message(context.Background(), message(t, link.TypeSharedPreviewGet, map[string]any{
			"commandId": commandID, "sessionId": sessionID, "fileId": fileID,
		}))
	}
	const picture, text, unknown, elsewhere, foreign = "11111111-0000-4000-8000-000000000001",
		"11111111-0000-4000-8000-000000000002", "11111111-0000-4000-8000-000000000003",
		"11111111-0000-4000-8000-000000000004", "11111111-0000-4000-8000-000000000005"
	ask(picture, sessionUnderTest, ids["home.png"])
	ask(text, sessionUnderTest, ids["notes.md"])
	ask(unknown, sessionUnderTest, "0123456789abcdef")
	ask(elsewhere, "7d3e5a10-0000-4000-8000-000000000000", ids["home.png"])
	ask(foreign, sessionUnderTest, other.ID)

	preview := s.sent.waitFor(t, "shared.preview", func(m any) bool {
		got, ok := m.(link.SharedPreview)
		return ok && got.CommandID == picture
	}).(link.SharedPreview)
	kept, err := transcript.ReadShared(s.h.app.Paths.Files(), sessionUnderTest, ids["home.png"])
	if err != nil {
		t.Fatal(err)
	}
	if preview.MediaType != "image/jpeg" || preview.Data == "" || preview.Data != kept.Preview.Data {
		t.Fatalf("preview = %s, %d bytes", preview.MediaType, len(preview.Data))
	}
	for commandID, want := range map[string]string{
		text:      sessionsdomain.ErrSharedFileNoPreview.Code,
		unknown:   sessionsdomain.ErrSharedFileNotFound.Code,
		elsewhere: sessionsdomain.ErrNotFound.Code,
		foreign:   sessionsdomain.ErrSharedFileNotFound.Code,
	} {
		if failed := s.sent.waitFor(t, "command.failed", isCommandFailed(commandID)).(link.CommandFailed); failed.Code != want {
			t.Fatalf("%s: code = %s, want %s", commandID, failed.Code, want)
		}
	}
	if !slices.Contains((&linkHandler{}).capabilities(), link.CapabilitySharedPreview) {
		t.Fatal("the hello does not offer shared.preview")
	}
}
