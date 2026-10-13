package domain_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func ptr[T any](v T) *T { return &v }

// A result as `claude -p --output-format json` prints it (Claude Code 2.x),
// with a smaller model handling part of the turn.
const claudeJSONResult = `{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 41233,
  "duration_api_ms": 39120,
  "num_turns": 7,
  "result": "Renamed the flag and updated both call sites.",
  "session_id": "4f1c2d3e-5a6b-7c8d-9e0f-112233445566",
  "total_cost_usd": 0.1834,
  "usage": {
    "input_tokens": 41,
    "cache_creation_input_tokens": 9876,
    "cache_read_input_tokens": 123456,
    "output_tokens": 2210,
    "server_tool_use": {"web_search_requests": 0},
    "service_tier": "standard"
  },
  "modelUsage": {
    "claude-haiku-4-5-20251001": {
      "inputTokens": 900, "outputTokens": 40, "cacheReadInputTokens": 0,
      "cacheCreationInputTokens": 0, "webSearchRequests": 0, "costUSD": 0.0011,
      "contextWindow": 200000
    },
    "claude-sonnet-4-5-20250929": {
      "inputTokens": 41, "outputTokens": 2210, "cacheReadInputTokens": 123456,
      "cacheCreationInputTokens": 9876, "webSearchRequests": 0, "costUSD": 0.1823,
      "contextWindow": 200000
    }
  },
  "permission_denials": [
    {"tool_name": "Bash", "tool_use_id": "toolu_01", "tool_input": {"command": "rm -rf build"}}
  ],
  "uuid": "9a8b7c6d-0000-4000-8000-000000000001"
}`

// The same turn as `--output-format stream-json --verbose` prints it: the init
// line names the session's model, then the conversation, then the result.
const claudeStreamResult = `{"type":"system","subtype":"init","cwd":"/w","session_id":"s-1","tools":["Bash","Edit"],"mcp_servers":[],"model":"claude-opus-4-1-20250805","permissionMode":"default","apiKeySource":"none"}
{"type":"assistant","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-4-1-20250805","content":[{"type":"text","text":"Looking."}],"usage":{"input_tokens":3,"output_tokens":5}},"session_id":"s-1"}
not json: a warning some wrapper printed
{"type":"result","subtype":"success","is_error":false,"result":"Done.","session_id":"s-1","total_cost_usd":0.42,"usage":{"input_tokens":10,"cache_creation_input_tokens":20,"cache_read_input_tokens":30,"output_tokens":40},"permission_denials":[]}
`

func TestParseClaudeTurnResult(t *testing.T) {
	cases := []struct {
		name   string
		output string
		want   domain.TurnResult
	}{
		{
			name:   "json output sums every model and names the one that cost the most",
			output: claudeJSONResult,
			want: domain.TurnResult{
				Result:            ptr("Renamed the flag and updated both call sites."),
				AgentSessionID:    ptr("4f1c2d3e-5a6b-7c8d-9e0f-112233445566"),
				CostUSD:           ptr(0.1834),
				PermissionDenials: ptr(1),
				Model:             ptr("claude-sonnet-4-5-20250929"),
				InputTokens:       ptr[int64](941),
				OutputTokens:      ptr[int64](2250),
				CacheReadTokens:   ptr[int64](123456),
				CacheWriteTokens:  ptr[int64](9876),
			},
		},
		{
			name:   "stream-json takes the model from init and the usage from the result",
			output: claudeStreamResult,
			want: domain.TurnResult{
				Result:            ptr("Done."),
				AgentSessionID:    ptr("s-1"),
				CostUSD:           ptr(0.42),
				PermissionDenials: ptr(0),
				Model:             ptr("claude-opus-4-1-20250805"),
				InputTokens:       ptr[int64](10),
				OutputTokens:      ptr[int64](40),
				CacheReadTokens:   ptr[int64](30),
				CacheWriteTokens:  ptr[int64](20),
			},
		},
		{
			name:   "a result without usage or model reports them unknown, not zero",
			output: `{"type":"result","subtype":"error_max_turns","is_error":true,"session_id":"s-2","total_cost_usd":0.01}`,
			want: domain.TurnResult{
				AgentSessionID: ptr("s-2"),
				CostUSD:        ptr(0.01),
			},
		},
		{
			name:   "a partial usage block keeps what it has",
			output: `{"type":"result","result":"ok","usage":{"input_tokens":7,"output_tokens":-1}}`,
			want: domain.TurnResult{
				Result:      ptr("ok"),
				InputTokens: ptr[int64](7),
			},
		},
		{
			name:   "output that never reached a result keeps the init model only",
			output: `{"type":"system","subtype":"init","model":"claude-sonnet-4-5"}` + "\n",
			want:   domain.TurnResult{Model: ptr("claude-sonnet-4-5")},
		},
		{
			name:   "an agent that prints no JSON reports nothing",
			output: "Done. Changed 3 files.\n",
			want:   domain.TurnResult{},
		},
		{name: "empty output", output: "", want: domain.TurnResult{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := domain.ParseClaudeTurnResult([]byte(tc.output))
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %s\nwant %s", describe(got), describe(tc.want))
			}
		})
	}
}

// describe prints the pointers' values, which %+v would print as addresses.
func describe(r domain.TurnResult) string {
	b, _ := json.Marshal(r)
	return string(b)
}
