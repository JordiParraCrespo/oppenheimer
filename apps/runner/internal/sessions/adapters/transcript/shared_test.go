package transcript_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const sharingSession = "4b1e0c9a-7d2f-4e61-9a3b-2c8d5f6e7a10"

// screenshot is a PNG large enough that its preview must be shrunk to fit.
func screenshot(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2400, 1600))
	for y := 0; y < 1600; y++ {
		for x := 0; x < 2400; x++ {
			img.Set(x, y, color.RGBA{uint8(x * y), uint8(x ^ y), uint8(x + y), 255})
		}
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, out.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
}

// The regression this guards: a shared screenshot whose entry is over the
// link's 64 KB for a chat entry is dropped by the follower, and the person
// never sees it.
func TestASharedImageIsAPreviewThatFitsTheChat(t *testing.T) {
	work := t.TempDir()
	path := filepath.Join(work, "home-dark.png")
	screenshot(t, path)

	shared, err := transcript.SaveShared(t.TempDir(), sharingSession, path, "The home page, dark", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if shared.MediaType != "image/png" || shared.Name != "home-dark.png" || shared.Caption != "The home page, dark" {
		t.Fatalf("shared: %+v", shared)
	}
	if shared.Preview == nil || shared.Preview.MediaType != "image/jpeg" {
		t.Fatalf("no JPEG preview: %+v", shared.Preview)
	}
	raw, err := base64.StdEncoding.DecodeString(shared.Preview.Data)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := image.Decode(bytes.NewReader(raw)); err != nil {
		t.Fatalf("the preview is not an image: %v", err)
	}
	if len(shared.Preview.Data) > transcript.SharedEntryMax {
		t.Fatalf("preview of %d bytes is over the entry's room", len(shared.Preview.Data))
	}
}

func TestASmallTextFileTravelsAsItsTextAndALargeOneByName(t *testing.T) {
	work, files := t.TempDir(), t.TempDir()
	small := filepath.Join(work, "notes.md")
	if err := os.WriteFile(small, []byte("# Findings\n\nTwo bugs.\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	shared, err := transcript.SaveShared(files, sharingSession, small, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if shared.Text == nil || *shared.Text != "# Findings\n\nTwo bugs.\n" {
		t.Fatalf("text: %v", shared.Text)
	}

	large := filepath.Join(work, "build.log")
	if err := os.WriteFile(large, []byte(strings.Repeat("line\n", 20_000)), 0o600); err != nil {
		t.Fatal(err)
	}
	shared, err = transcript.SaveShared(files, sharingSession, large, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if shared.Text != nil || shared.Preview != nil || shared.Size != 100_000 || shared.Path != large {
		t.Fatalf("a large file must go by name only: %+v", shared)
	}
}

func TestADirectoryOrAMissingFileIsRefused(t *testing.T) {
	files := t.TempDir()
	if _, err := transcript.SaveShared(files, sharingSession, t.TempDir(), "", time.Now()); !errors.Is(err, transcript.ErrSharedNotFile) {
		t.Fatalf("a directory: %v", err)
	}
	if _, err := transcript.SaveShared(files, sharingSession, "/no/such/file.png", "", time.Now()); !errors.Is(err, transcript.ErrSharedRead) {
		t.Fatalf("a missing file: %v", err)
	}
}

// The regression this guards: shared files sent only once per runner, so a
// browser that attaches later (a reload, a second tab) never sees them.
func TestTheChatSendsEverySharedFileAfterTheHistoryAndEachNewOne(t *testing.T) {
	projects := write(t, promptLine, answerLine)
	files, work := t.TempDir(), t.TempDir()
	first := filepath.Join(work, "first.txt")
	if err := os.WriteFile(first, []byte("one"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := transcript.SaveShared(files, conversation, first, "", time.Now()); err != nil {
		t.Fatal(err)
	}

	for attach := range 2 {
		sink := &batches{}
		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan struct{})
		go func() {
			defer close(done)
			_ = transcript.New(transcript.Options{ClaudeProjects: projects, FilesDir: files}).Follow(ctx,
				domain.Session{ID: conversation, Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}},
				64<<10, 256, nil, sink.emit)
		}()
		eventually(t, "the history and the shared file", func() bool { return len(sink.entries()) == 3 })
		if got := sink.entries()[2]["name"]; got != "first.txt" {
			t.Fatalf("attachment %d: third entry %v", attach, sink.entries()[2])
		}
		if attach == 1 {
			second := filepath.Join(work, "second.txt")
			if err := os.WriteFile(second, []byte("two"), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := transcript.SaveShared(files, conversation, second, "", time.Now()); err != nil {
				t.Fatal(err)
			}
			eventually(t, "the new shared file", func() bool { return len(sink.entries()) == 4 })
			if got := sink.entries()[3]["type"]; got != transcript.SharedEntryType {
				t.Fatalf("new entry: %v", sink.entries()[3])
			}
			time.Sleep(700 * time.Millisecond)
			if n := len(sink.entries()); n != 4 {
				t.Fatalf("a shared file was sent twice: %d entries", n)
			}
		}
		cancel()
		<-done
	}
}

// The regression this guards: a text file under the raw text limit whose
// JSON escapes (`<` becomes `<`) outgrow the entry, saved anyway and
// then left out by the follower, so not even its name reached the chat.
func TestATextFileThatEscapesPastTheEntryGoesByName(t *testing.T) {
	work, files := t.TempDir(), t.TempDir()
	page := filepath.Join(work, "page.html")
	if err := os.WriteFile(page, []byte(strings.Repeat("<div></div>", 2_700)), 0o600); err != nil {
		t.Fatal(err)
	}
	shared, err := transcript.SaveShared(files, sharingSession, page, "", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if shared.Text != nil {
		t.Fatal("the text was kept although its entry is over the room")
	}
	entries, err := os.ReadDir(transcript.SharedDir(files, sharingSession))
	if err != nil || len(entries) != 1 {
		t.Fatalf("kept %v, %v", entries, err)
	}
	info, err := entries[0].Info()
	if err != nil || info.Size() > transcript.SharedEntryMax {
		t.Fatalf("entry of %d bytes, %v", info.Size(), err)
	}
}

// The regression this guards: every shared file sent to a new attachment in
// one batch, over the link's frame limit, refused and offered again for good.
func TestSharedFilesGoInBatchesTheLinkTakes(t *testing.T) {
	projects := write(t, promptLine, answerLine)
	files, work := t.TempDir(), t.TempDir()
	for i := range 17 {
		path := filepath.Join(work, fmt.Sprintf("notes-%02d.txt", i))
		if err := os.WriteFile(path, []byte(strings.Repeat("x", 30_000)), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := transcript.SaveShared(files, conversation, path, "", time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	sink := &batches{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects, FilesDir: files}).Follow(ctx,
			domain.Session{ID: conversation, Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}},
			64<<10, 256, nil, sink.emit)
	}()
	defer func() { cancel(); <-done }()
	eventually(t, "every shared file", func() bool { return len(sink.entries()) == 2+17 })
	sink.mu.Lock()
	defer sink.mu.Unlock()
	for _, batch := range sink.got {
		size := 0
		for _, entry := range batch.Entries {
			size += len(entry)
		}
		if size > 256<<10 {
			t.Fatalf("a batch of %d bytes", size)
		}
	}
}
