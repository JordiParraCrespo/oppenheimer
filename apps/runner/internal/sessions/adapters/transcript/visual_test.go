package transcript_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const deploys = `{"title":"Deploys this week","blocks":[
  {"type":"metrics","items":[{"label":"Deploys","value":38,"delta":6}]},
  {"type":"bar","labels":["Mon","Tue"],"series":[{"label":"api","values":[4,7]}]}]}`

// The agent fixes its spec from these lines alone: a fault without its
// path, or a spec the console cannot draw taken anyway, leaves it guessing.
func TestCheckVisualNamesEachFaultByItsPath(t *testing.T) {
	if problems := transcript.CheckVisual([]byte(deploys)); len(problems) != 0 {
		t.Fatalf("a valid spec refused: %v", problems)
	}
	cases := map[string]struct{ spec, want string }{
		"no title":           {`{"blocks":[{"type":"markdown","text":"x"}]}`, "title: required"},
		"no blocks":          {`{"title":"x","blocks":[]}`, "blocks: give at least one block"},
		"unknown type":       {`{"title":"x","blocks":[{"type":"pie"}]}`, "blocks[0].type: unknown block type"},
		"missing field":      {`{"title":"x","blocks":[{"type":"table","columns":[{"label":"a"}]}]}`, "blocks[0].rows: required"},
		"not an object":      {`[1,2]`, "visual: not a JSON object"},
		"over the entry max": {`{"title":"` + strings.Repeat("x", transcript.VisualSpecMax) + `"}`, "bytes; keep it under"},
	}
	for name, c := range cases {
		problems := transcript.CheckVisual([]byte(c.spec))
		if len(problems) == 0 || !strings.Contains(strings.Join(problems, "\n"), c.want) {
			t.Errorf("%s: got %v, want a line with %q", name, problems, c.want)
		}
	}
}

// The regression this guards: a visual kept somewhere the chat does not
// follow, or read back as a shared file by its id.
func TestAVisualReachesTheChatBesideSharedFiles(t *testing.T) {
	projects := write(t, promptLine, answerLine)
	files := t.TempDir()
	saved, err := transcript.SaveVisual(files, conversation, []byte(deploys), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := transcript.ReadShared(files, conversation, saved.ID); !errors.Is(err, transcript.ErrSharedMissing) {
		t.Fatalf("a visual read back as a shared file: %v", err)
	}
	sink := &batches{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects, FilesDir: files}).Follow(ctx,
			domain.Session{ID: conversation, Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}},
			64<<10, 256, nil, sink.emit)
	}()
	eventually(t, "the history and the visual", func() bool { return len(sink.entries()) == 3 })
	entry := sink.entries()[2]
	if entry["type"] != transcript.VisualEntryType {
		t.Fatalf("third entry: %v", entry)
	}
	visual, ok := entry["visual"].(map[string]any)
	if !ok || visual["title"] != "Deploys this week" {
		t.Fatalf("the spec did not travel whole: %v", entry["visual"])
	}
	cancel()
	<-done
}
