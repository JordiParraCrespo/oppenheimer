package cli

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const pulledCommand = "0b6f3f7e-5a3c-4c8e-9a4f-2f1d8c9b7a61"

func pullHandler(t *testing.T, serve http.HandlerFunc) *linkHandler {
	t.Helper()
	server := httptest.NewServer(serve)
	t.Cleanup(server.Close)
	return &linkHandler{
		app:       &App{Version: "test"},
		identity:  pairdomain.Identity{ControlPlaneURL: server.URL},
		bootToken: func(context.Context) (string, error) { return "boot-jwt", nil },
	}
}

func TestPullImageAsksForTheParkedImageWithTheHostsAssertion(t *testing.T) {
	var path, auth string
	h := pullHandler(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_, _ = w.Write([]byte("png-bytes"))
	})

	data, err := h.pullFile(context.Background(), pulledCommand)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "png-bytes" {
		t.Fatalf("data = %q", data)
	}
	if path != "/api/v1/hosts/self/images/"+pulledCommand || auth != "Bearer boot-jwt" {
		t.Fatalf("path = %q, auth = %q", path, auth)
	}
}

func TestPullImageReadsNoMoreThanTheCap(t *testing.T) {
	h := pullHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", sessionsdomain.FileMaxBytes+1)))
	})

	if _, err := h.pullFile(context.Background(), pulledCommand); err == nil {
		t.Fatal("a file over the cap must be refused, not written")
	}
}

func TestPullImageTreatsAnyRefusalAsAFailure(t *testing.T) {
	h := pullHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "gone", http.StatusNotFound)
	})

	_, err := h.pullFile(context.Background(), pulledCommand)
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("err = %v, want the control plane's 404 named", err)
	}
}

func TestPullCreateFilesFetchesEachAttachedImage(t *testing.T) {
	var paths []string
	h := pullHandler(t, func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		_, _ = w.Write([]byte("png-bytes"))
	})

	files, err := h.pullCreateFiles(context.Background(), []link.SessionCreateImages{
		{ImageID: pulledCommand, MediaType: "image/png"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0].ID != pulledCommand || string(files[0].Data) != "png-bytes" {
		t.Fatalf("files = %+v", files)
	}
	if len(paths) != 1 || paths[0] != "/api/v1/hosts/self/images/"+pulledCommand {
		t.Fatalf("paths = %q", paths)
	}
}

func TestPullCreateFilesRefusesAnIDThatIsNotOne(t *testing.T) {
	h := pullHandler(t, func(http.ResponseWriter, *http.Request) {
		t.Fatal("an id that is not one must not reach the control plane")
	})

	if _, err := h.pullCreateFiles(context.Background(), []link.SessionCreateImages{
		{ImageID: "../escape", MediaType: "image/png"},
	}); err == nil {
		t.Fatal("want a refusal")
	}
}

// Files sent one after another land in the agent's prompt in the order they
// were sent, even when the first one's pull is the slower: the pull and the
// paste are one job on the session's lane, so a second file cannot overtake
// the first while it downloads. Once each file was its own goroutine, and the
// faster pull pasted first.
func TestFilesPasteInTheOrderTheyWereSent(t *testing.T) {
	const first, second = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	slow := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, first) {
			<-slow
		}
		_, _ = w.Write(png)
	}))
	t.Cleanup(server.Close)
	// Cleanups run last first: a failure lets the slow pull go before the
	// server waits for it to finish.
	var released sync.Once
	release := func() { released.Do(func() { close(slow) }) }
	t.Cleanup(release)
	h, svc, git, terminals := newCreateHarness(t)
	h.identity = pairdomain.Identity{ControlPlaneURL: server.URL}
	h.bootToken = func(context.Context) (string, error) { return "boot-jwt", nil }
	ctx := context.Background()
	h.Message(ctx, createMessage(t, "11111111-1111-4111-8111-111111111111"))
	close(git.release)
	waitForLive(t, svc)

	image := func(id string) link.Message {
		return message(t, "session.image", map[string]any{
			"commandId": id, "sessionId": sessionUnderTest, "window": 0, "mediaType": "image/png",
		})
	}
	h.Message(ctx, image(first))
	h.Message(ctx, image(second))
	// The second file's pull is instant; it must still wait for the first.
	time.Sleep(50 * time.Millisecond)
	if pasted := terminals.PastesSoFar(); len(pasted) != 0 {
		t.Fatalf("pasted %q while the first file was still downloading", pasted)
	}
	release()

	deadline := time.Now().Add(2 * time.Second)
	for len(terminals.PastesSoFar()) < 2 {
		if time.Now().After(deadline) {
			t.Fatalf("pasted %q, want both files", terminals.PastesSoFar())
		}
		time.Sleep(time.Millisecond)
	}
	pasted := terminals.PastesSoFar()
	if !strings.Contains(pasted[0], first) || !strings.Contains(pasted[1], second) {
		t.Fatalf("pasted %q, want %s then %s", pasted, first, second)
	}
}

func waitForLive(t *testing.T, svc *sessionsapp.Service) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		session, err := svc.Get(sessionUnderTest)
		if err == nil && session.State.Live() {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("session is %+v (err %v), want it live", session.State, err)
		}
		time.Sleep(time.Millisecond)
	}
}
