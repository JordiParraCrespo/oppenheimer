package cli

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The largest report an agent can make still fits one event: a payload
// over the cap is refused by the control plane, and the session's dot would
// stop moving.
func TestTheLargestReportFitsAnEvent(t *testing.T) {
	text := strings.Repeat("<&>", 400)
	encoded := "state=blocked:kind=question:progress=99:msg=" + base64.StdEncoding.EncodeToString([]byte(text)) + ":title=" + base64.StdEncoding.EncodeToString([]byte(text))
	status, ok := sessionsdomain.ParseProgramStatus(encoded)
	if !ok {
		t.Fatal("not a report")
	}
	payload := map[string]any{"state": "blocked", "loginUrl": strings.Repeat("x", 512), "program": programPayload(&status)}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if len(body) > link.MaxEventPayloadBytes {
		t.Fatalf("payload of %d bytes, the cap is %d", len(body), link.MaxEventPayloadBytes)
	}
}
