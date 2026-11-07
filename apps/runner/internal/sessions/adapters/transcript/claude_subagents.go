package transcript

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Claude Code keeps each subagent's conversation beside the session's, in
// `<conversation>/subagents/agent-<id>.jsonl`, its lines marked
// `isSidechain` and carrying the agent's id, and what the subagent is in
// `agent-<id>.meta.json`: its kind (`agentType`), its task (`description`),
// the `Agent` call that started it (`toolUseId`, in the session's
// transcript or, for one a subagent started, in that subagent's), and
// whether it has finished. Read off Claude Code 2.1's own files; a
// subagent with no meta yet is left until it has one, since nothing else
// says which call it belongs to.

// claudeAgentFile is a subagent's conversation file; anything else in the
// folder (its meta, its prompt cache's record) is not.
var claudeAgentFile = regexp.MustCompile(`^agent-([0-9A-Za-z_-]{1,64})\.jsonl$`)

// claudeSubagentMetaMax bounds the read of a subagent's meta file.
const claudeSubagentMetaMax = 64 << 10

// claudeSubagentMeta is the part of Claude Code's meta file the chat reads.
type claudeSubagentMeta struct {
	AgentType   string `json:"agentType"`
	Description string `json:"description"`
	ToolUseID   string `json:"toolUseId"`
	Finished    bool   `json:"finished"`
}

var _ subagentSource = claudeReader{}

// subagents implements subagentSource.
func (claudeReader) subagents(main string) []subagentFile {
	if !strings.HasSuffix(main, ".jsonl") {
		return nil
	}
	dir := filepath.Join(strings.TrimSuffix(main, ".jsonl"), "subagents")
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var files []subagentFile
	for _, item := range items {
		match := claudeAgentFile.FindStringSubmatch(item.Name())
		if match == nil || !item.Type().IsRegular() {
			continue
		}
		id := match[1]
		meta, ok := claudeMetaOf(filepath.Join(dir, "agent-"+id+".meta.json"))
		if !ok || meta.ToolUseID == "" {
			continue
		}
		state := subagentRunning
		if meta.Finished {
			state = subagentCompleted
		}
		files = append(files, subagentFile{
			path: filepath.Join(dir, item.Name()),
			meta: subagentMeta{
				ID: id, ParentToolUseID: meta.ToolUseID, AgentType: meta.AgentType,
				Description: meta.Description, State: state,
			},
		})
	}
	return files
}

func claudeMetaOf(path string) (claudeSubagentMeta, bool) {
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() > claudeSubagentMetaMax {
		return claudeSubagentMeta{}, false
	}
	raw, err := os.ReadFile(path) //nolint:gosec // a meta file in Claude Code's own subagents folder, its name checked
	if err != nil {
		return claudeSubagentMeta{}, false
	}
	var meta claudeSubagentMeta
	if json.Unmarshal(raw, &meta) != nil {
		return claudeSubagentMeta{}, false
	}
	return meta, true
}

// subagentLine implements subagentSource: Claude Code's meta says how a
// subagent stands, and its lines' usage is counted in the console.
func (claudeReader) subagentLine([]byte) (string, int64) { return "", 0 }
