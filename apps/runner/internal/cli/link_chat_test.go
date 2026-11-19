package cli

import (
	"encoding/json"
	"strings"
	"testing"

	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
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

// The project's commands go on the wire with the batch, so the console's `/`
// menu can offer them.
func TestAChatResetCarriesTheProjectsCommands(t *testing.T) {
	body, err := json.Marshal(attachmentChat(1, sessionsapp.ChatBatch{
		Reset:    true,
		Commands: []sessionsdomain.SlashCommand{{Name: "recap", Kind: sessionsdomain.SlashCommandSkill, Description: "Close it"}},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"commands":[{"name":"recap","kind":"skill","description":"Close it"}]`) {
		t.Fatalf("commands are not on the wire: %s", body)
	}
	body, _ = json.Marshal(attachmentChat(1, sessionsapp.ChatBatch{Entries: []string{"{}"}}))
	if strings.Contains(string(body), "commands") {
		t.Fatalf("a batch with no commands names them: %s", body)
	}
}
