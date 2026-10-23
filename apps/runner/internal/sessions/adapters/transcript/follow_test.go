package transcript_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// batches records what Follow emitted, and can refuse like a full link queue.
type batches struct {
	mu      sync.Mutex
	got     []app.ChatBatch
	refuse  int
	refused int
}

func (b *batches) emit(batch app.ChatBatch) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.refused < b.refuse {
		b.refused++
		return errors.New("backpressure")
	}
	b.got = append(b.got, app.ChatBatch{Reset: batch.Reset, Entries: append([]string(nil), batch.Entries...)})
	return nil
}

// entries is every entry received since the last reset.
func (b *batches) entries() []map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	var out []map[string]any
	for _, batch := range b.got {
		if batch.Reset {
			out = nil
		}
		for _, entry := range batch.Entries {
			var decoded map[string]any
			_ = json.Unmarshal([]byte(entry), &decoded)
			out = append(out, decoded)
		}
	}
	return out
}

func follow(t *testing.T, projects string, sink *batches) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects}).
			Follow(ctx, domain.AgentClaude, conversation, 64<<10, 256, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
}

func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestTheChatIsTheHistoryThenEachLineTheAgentAppends(t *testing.T) {
	projects := write(t, snapshotLine, promptLine, answerLine)
	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "the history", func() bool { return len(sink.entries()) == 2 })
	if !sink.got[0].Reset {
		t.Fatal("the history must start with a reset")
	}

	path := filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer", conversation+".jsonl")
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()
	// Half a line is held until the CLI finishes writing it.
	half := `{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done."}]}}`
	_, _ = file.WriteString(half[:20])
	time.Sleep(700 * time.Millisecond)
	if n := len(sink.entries()); n != 2 {
		t.Fatalf("a half-written line was sent: %d entries", n)
	}
	_, _ = file.WriteString(half[20:] + "\n")
	eventually(t, "the appended line", func() bool { return len(sink.entries()) == 3 })
	if text := sink.entries()[2]["message"].(map[string]any)["content"].([]any)[0].(map[string]any)["text"]; text != "Done." {
		t.Fatalf("appended entry: %v", text)
	}
}

func TestABatchTheLinkRefusesIsOfferedAgain(t *testing.T) {
	projects := write(t, promptLine, answerLine)
	sink := &batches{refuse: 2}
	follow(t, projects, sink)
	eventually(t, "the history after the refusals", func() bool { return len(sink.entries()) == 2 })
}

func TestAConversationNotWrittenYetSaysSoAndWaits(t *testing.T) {
	projects := t.TempDir()
	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "an empty reset", func() bool {
		sink.mu.Lock()
		defer sink.mu.Unlock()
		return len(sink.got) == 1 && sink.got[0].Reset && len(sink.got[0].Entries) == 0
	})
	dir := filepath.Join(projects, "-w")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, conversation+".jsonl"), []byte(promptLine+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	eventually(t, "the first message", func() bool { return len(sink.entries()) == 1 })
}

func TestTheChatCarriesNoImageBytesSignaturesOrWholeFiles(t *testing.T) {
	big := strings.Repeat("x", 200<<10)
	lines := []string{
		`{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"text","text":"look"},{"type":"image","source":{"type":"base64","data":"` + big + `"}}]}}`,
		`{"type":"assistant","uuid":"a","message":{"role":"assistant","content":[{"type":"thinking","thinking":"","signature":"` + big + `"},{"type":"tool_use","id":"t1","name":"Write","input":{"file_path":"a.go","content":"` + big + `"}}]}}`,
		`{"type":"user","uuid":"r","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"` + big + `"}]}}`,
		`{"type":"attachment","attachment":{"type":"environment"}}`,
	}
	sink := &batches{}
	follow(t, write(t, lines...), sink)
	eventually(t, "three entries", func() bool { return len(sink.entries()) == 3 })
	for _, batch := range sink.got {
		for _, entry := range batch.Entries {
			if len(entry) > 16<<10 {
				t.Fatalf("an entry of %d bytes left the host", len(entry))
			}
		}
	}
	content := func(i int) []any { return sink.entries()[i]["message"].(map[string]any)["content"].([]any) }
	if image := content(0)[1].(map[string]any); image["type"] != "image" || image["source"] != nil {
		t.Fatalf("image: %v", image)
	}
	if blocks := content(1); len(blocks) != 1 || blocks[0].(map[string]any)["name"] != "Write" || blocks[0].(map[string]any)["truncated"] != true {
		t.Fatalf("an empty thinking block is dropped and the written file cut: %v", blocks)
	}
	if result := content(2)[0].(map[string]any); result["tool_use_id"] != "t1" || result["truncated"] != true {
		t.Fatalf("tool result: %v", result)
	}
}

func TestOnlyClaudeHasAChatToFollow(t *testing.T) {
	err := transcript.New(transcript.Options{ClaudeProjects: t.TempDir()}).
		Follow(context.Background(), domain.AgentCodex, conversation, 1, 1, func(app.ChatBatch) error { return nil })
	if !errors.Is(err, app.ErrNoChat) {
		t.Fatalf("codex: %v", err)
	}
}
