package domain

import (
	"bytes"
	"encoding/json"
	"sort"
)

// TurnResult is what a headless agent says about a turn once it has exited:
// the answer, what it cost and what it used. Every field is optional because
// agents report different things — Claude Code reports all of them, another
// CLI may report none — and an absent value is unknown, never zero.
//
// It travels as the payload of `turn.ended`
// (`packages/shared/src/protocol/turn-event.ts`). The cost is the agent's own
// figure: nothing here prices tokens, because a price list is a thing someone
// would have to keep current (23 §4).
type TurnResult struct {
	Result            *string
	AgentSessionID    *string
	CostUSD           *float64
	PermissionDenials *int
	// Model is the model that did the turn's work. Claude Code may route part
	// of a turn to a smaller model; the one named here is the session's own
	// (the init message), or else the one that cost the most.
	Model *string
	// The token counts are the turn's totals over every model it used, so
	// they add up to the same work CostUSD prices.
	InputTokens      *int64
	OutputTokens     *int64
	CacheReadTokens  *int64
	CacheWriteTokens *int64
}

// ParseClaudeTurnResult reads Claude Code's headless output: either the one
// object `--output-format json` prints, or the lines of
// `--output-format stream-json`, of which the `system`/`init` line names the
// model and the `result` line carries the rest. Lines it cannot parse are
// skipped (a stray warning on stdout must not cost the turn its usage), and
// output with no result at all answers an empty TurnResult.
func ParseClaudeTurnResult(output []byte) TurnResult {
	var (
		initModel string
		result    *claudeResult
	)
	for _, line := range claudeMessages(output) {
		var head struct {
			Type    string `json:"type"`
			Subtype string `json:"subtype"`
			Model   string `json:"model"`
		}
		if json.Unmarshal(line, &head) != nil {
			continue
		}
		switch {
		case head.Type == "system" && head.Subtype == "init" && head.Model != "":
			initModel = head.Model
		case head.Type == "result":
			var r claudeResult
			if json.Unmarshal(line, &r) == nil {
				result = &r
			}
		}
	}
	if result == nil {
		if initModel == "" {
			return TurnResult{}
		}
		return TurnResult{Model: &initModel}
	}
	return result.turnResult(initModel)
}

// claudeMessages splits the output into JSON values: one per line for
// stream-json, and the whole output when it is a single (possibly indented)
// object.
func claudeMessages(output []byte) [][]byte {
	trimmed := bytes.TrimSpace(output)
	if len(trimmed) == 0 {
		return nil
	}
	if json.Valid(trimmed) {
		return [][]byte{trimmed}
	}
	var lines [][]byte
	for _, line := range bytes.Split(trimmed, []byte("\n")) {
		if line = bytes.TrimSpace(line); len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

// claudeResult is the subset of Claude Code's result message this host reads.
type claudeResult struct {
	Result            *string                     `json:"result"`
	SessionID         *string                     `json:"session_id"`
	TotalCostUSD      *float64                    `json:"total_cost_usd"`
	PermissionDenials *[]json.RawMessage          `json:"permission_denials"`
	Usage             *claudeUsage                `json:"usage"`
	ModelUsage        map[string]claudeModelUsage `json:"modelUsage"`
}

type claudeUsage struct {
	InputTokens              *int64 `json:"input_tokens"`
	OutputTokens             *int64 `json:"output_tokens"`
	CacheReadInputTokens     *int64 `json:"cache_read_input_tokens"`
	CacheCreationInputTokens *int64 `json:"cache_creation_input_tokens"`
}

type claudeModelUsage struct {
	InputTokens              int64   `json:"inputTokens"`
	OutputTokens             int64   `json:"outputTokens"`
	CacheReadInputTokens     int64   `json:"cacheReadInputTokens"`
	CacheCreationInputTokens int64   `json:"cacheCreationInputTokens"`
	CostUSD                  float64 `json:"costUSD"`
}

func (r *claudeResult) turnResult(initModel string) TurnResult {
	out := TurnResult{
		Result:         nonEmpty(r.Result),
		AgentSessionID: nonEmpty(r.SessionID),
	}
	if r.TotalCostUSD != nil && *r.TotalCostUSD >= 0 {
		out.CostUSD = r.TotalCostUSD
	}
	if r.PermissionDenials != nil {
		n := len(*r.PermissionDenials)
		out.PermissionDenials = &n
	}

	model := initModel
	if model == "" {
		model = mostExpensiveModel(r.ModelUsage)
	}
	if model != "" {
		out.Model = &model
	}

	// modelUsage covers every model the turn touched, which is what the cost
	// covers too; `usage` is the fallback for a version that sends only it.
	if len(r.ModelUsage) > 0 {
		var in, outTokens, read, write int64
		for _, u := range r.ModelUsage {
			in += u.InputTokens
			outTokens += u.OutputTokens
			read += u.CacheReadInputTokens
			write += u.CacheCreationInputTokens
		}
		out.InputTokens, out.OutputTokens = counted(in), counted(outTokens)
		out.CacheReadTokens, out.CacheWriteTokens = counted(read), counted(write)
	} else if r.Usage != nil {
		out.InputTokens = nonNegative(r.Usage.InputTokens)
		out.OutputTokens = nonNegative(r.Usage.OutputTokens)
		out.CacheReadTokens = nonNegative(r.Usage.CacheReadInputTokens)
		out.CacheWriteTokens = nonNegative(r.Usage.CacheCreationInputTokens)
	}
	return out
}

// mostExpensiveModel names the model that cost the most, then the one that
// wrote the most, then the first by name, so the answer never depends on map
// order.
func mostExpensiveModel(usage map[string]claudeModelUsage) string {
	names := make([]string, 0, len(usage))
	for name := range usage {
		if name != "" {
			names = append(names, name)
		}
	}
	if len(names) == 0 {
		return ""
	}
	sort.Slice(names, func(i, j int) bool {
		a, b := usage[names[i]], usage[names[j]]
		if a.CostUSD != b.CostUSD {
			return a.CostUSD > b.CostUSD
		}
		if a.OutputTokens != b.OutputTokens {
			return a.OutputTokens > b.OutputTokens
		}
		return names[i] < names[j]
	})
	return names[0]
}

func nonEmpty(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

func nonNegative(n *int64) *int64 {
	if n == nil || *n < 0 {
		return nil
	}
	return n
}

func counted(n int64) *int64 {
	if n < 0 {
		return nil
	}
	return &n
}
