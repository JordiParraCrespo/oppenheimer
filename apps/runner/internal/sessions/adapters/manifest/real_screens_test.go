package manifest_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Screens captured from the real CLIs in tmux (`testdata/screens`, a `.txt`
// body and the pane's `.title`). Every moment an agent waits on the person
// must read as blocked, or the session never reaches the Inbox and nobody is
// told: before these, Codex's approval and question and every OpenCode
// permission read as working or unknown.
func TestRealScreensReadAsTheStateTheyShow(t *testing.T) {
	c := classifier(t, "")
	for _, tc := range []struct {
		screen string
		agent  domain.Agent
		want   domain.State
	}{
		{"codex-approval", domain.AgentCodex, domain.StateBlocked},
		{"codex-question", domain.AgentCodex, domain.StateBlocked},
		{"codex-working", domain.AgentCodex, domain.StateWorking},
		{"codex-idle", domain.AgentCodex, domain.StateIdle},
		{"codex-after-deny", domain.AgentCodex, domain.StateIdle},
		{"opencode-permission-directory", domain.AgentOpenCode, domain.StateBlocked},
		{"opencode-permission-bash", domain.AgentOpenCode, domain.StateBlocked},
		{"opencode-working", domain.AgentOpenCode, domain.StateWorking},
		{"opencode-idle", domain.AgentOpenCode, domain.StateIdle},
	} {
		t.Run(tc.screen, func(t *testing.T) {
			screen := app.Screen{Body: read(t, tc.screen+".txt"), Title: strings.TrimSpace(read(t, tc.screen+".title"))}
			if got, _ := c.Classify(screen, tc.agent); got != tc.want {
				t.Fatalf("%s = %q, want %q", tc.screen, got, tc.want)
			}
		})
	}
}

// A terminal that drops the title still shows the prompt on screen.
func TestCodexWaitingReadsAsBlockedWithoutItsTitle(t *testing.T) {
	c := classifier(t, "")
	for _, name := range []string{"codex-approval", "codex-question"} {
		if got, _ := c.Classify(app.Screen{Body: read(t, name+".txt")}, domain.AgentCodex); got != domain.StateBlocked {
			t.Fatalf("%s without a title = %q, want blocked", name, got)
		}
	}
}

func read(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", "screens", name))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
