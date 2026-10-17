package cli

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"
)

// The payload is what the control plane folds onto session_turn by key name,
// so the test reads it the way the control plane does: as JSON.
func TestTurnEndedPayload(t *testing.T) {
	cases := []struct {
		name     string
		exitCode int
		output   string
		want     map[string]any
	}{
		{
			name:     "a Claude Code result carries its model and usage",
			exitCode: 0,
			output: `{"type":"result","result":"Done.","session_id":"s-1","total_cost_usd":0.5,` +
				`"usage":{"input_tokens":1,"output_tokens":2,"cache_read_input_tokens":3,"cache_creation_input_tokens":4},` +
				`"modelUsage":{"claude-sonnet-4-5":{"inputTokens":1,"outputTokens":2,"cacheReadInputTokens":3,"cacheCreationInputTokens":4,"costUSD":0.5}},` +
				`"permission_denials":[]}`,
			want: map[string]any{
				"exitCode": 0.0, "agentSessionId": "s-1", "result": "Done.", "costUsd": 0.5,
				"permissionDenials": 0.0, "model": "claude-sonnet-4-5",
				"inputTokens": 1.0, "outputTokens": 2.0, "cacheReadTokens": 3.0, "cacheWriteTokens": 4.0,
			},
		},
		{
			name:     "an agent that reports nothing sends the exit code alone",
			exitCode: 2,
			output:   "error: not logged in\n",
			want:     map[string]any{"exitCode": 2.0},
		},
		{
			name:     "a model id too long for the column is dropped, not cut",
			exitCode: 0,
			output:   `{"type":"system","subtype":"init","model":"` + strings.Repeat("m", 65) + `"}`,
			want:     map[string]any{"exitCode": 0.0},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(turnEndedPayload(tc.exitCode, []byte(tc.output)))
			if err != nil {
				t.Fatal(err)
			}
			var got map[string]any
			if err := json.Unmarshal(body, &got); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %s\nwant %v", body, tc.want)
			}
		})
	}
}

func TestTurnEndedPayloadKeepsALongAnswerInsideTheEventCap(t *testing.T) {
	answer := strings.Repeat("é", turnResultMaxBytes) // two bytes each
	output, _ := json.Marshal(map[string]any{"type": "result", "result": answer})

	payload := turnEndedPayload(0, output)

	if payload.Result == nil || len(*payload.Result) > turnResultMaxBytes || !utf8.ValidString(*payload.Result) {
		t.Fatalf("result not cut to %d bytes on a character boundary", turnResultMaxBytes)
	}
}
