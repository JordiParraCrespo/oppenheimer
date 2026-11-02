package cli

import (
	"encoding/json"
	"strings"
	"testing"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// A conversation with nothing written yet opens with an empty reset. The
// control plane refuses `entries: null`, so sending one would leave the
// console on the terminal until the agent wrote its first line.
func TestAnEmptyChatResetGoesAsAnEmptyList(t *testing.T) {
	body, err := json.Marshal(attachmentChat(1, sessionsapp.ChatBatch{Reset: true}))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"entries":[]`) {
		t.Fatalf("entries are not an empty list: %s", body)
	}
}
