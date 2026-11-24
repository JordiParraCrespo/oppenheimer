package transcript

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// VisualEntryType names the chat entry for a visual an agent showed the
// person (`runner sessions show`, the MCP tool `show_visual`): a title and
// typed blocks the console draws with its own charts. The spec's full
// contract is `@oppenheimer/shared/schemas/visual`, which the console checks
// again; CheckVisual here catches what an agent gets wrong most, so it hears
// of it at once instead of seeing a folded note in the chat.
const VisualEntryType = "oppenheimer.visual"

const (
	// VisualSpecMax bounds a visual's spec, in bytes of its JSON: what one
	// entry may carry under the link's 64 KB with the entry's own fields.
	VisualSpecMax   = 60 << 10
	visualBlocksMax = 24
	visualSeriesMax = 5
)

// VisualEntry is one visual an agent showed, as the chat entry the console reads.
type VisualEntry struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	Timestamp string          `json:"timestamp"`
	Visual    json.RawMessage `json:"visual"`
}

// visualBlockTypes are the block types the console draws.
var visualBlockTypes = []string{
	"markdown", "metrics", "bar", "line", "area", "ring", "ranking",
	"table", "checklist", "progress", "record", "callout", "links",
}

// visualRequired names, for each block type, the fields it cannot draw without.
var visualRequired = map[string][]string{
	"markdown": {"text"}, "metrics": {"items"}, "bar": {"labels", "series"},
	"line": {"labels", "series"}, "area": {"labels", "series"}, "ring": {"segments"},
	"ranking": {"items"}, "table": {"columns", "rows"}, "checklist": {"items"},
	"progress": {"items"}, "record": {"fields"}, "callout": {"text"}, "links": {"items"},
}

type visualSpec struct {
	Title  *string           `json:"title"`
	Blocks []json.RawMessage `json:"blocks"`
}

type visualBlock struct {
	Type   string            `json:"type"`
	Labels []json.RawMessage `json:"labels"`
	Series []struct {
		Values []json.RawMessage `json:"values"`
	} `json:"series"`
	Columns []json.RawMessage   `json:"columns"`
	Rows    [][]json.RawMessage `json:"rows"`
}

// CheckVisual is what is wrong with a spec, one line per fault with the
// path at fault ("blocks[2].series[0].values: …"), at most eight; none when
// the runner finds nothing. It checks the shape, not every bound.
func CheckVisual(spec []byte) []string {
	if len(spec) > VisualSpecMax {
		return []string{fmt.Sprintf("visual: %d bytes; keep it under %d (fewer rows or points)", len(spec), VisualSpecMax)}
	}
	var visual visualSpec
	if err := json.Unmarshal(spec, &visual); err != nil {
		return []string{"visual: not a JSON object with a title and blocks: " + err.Error()}
	}
	var problems []string
	add := func(format string, args ...any) { problems = append(problems, fmt.Sprintf(format, args...)) }
	if visual.Title == nil || strings.TrimSpace(*visual.Title) == "" {
		add("title: required, a few words")
	}
	switch {
	case len(visual.Blocks) == 0:
		add("blocks: give at least one block")
	case len(visual.Blocks) > visualBlocksMax:
		add("blocks: %d blocks; at most %d", len(visual.Blocks), visualBlocksMax)
	}
	for i, raw := range visual.Blocks {
		var fields map[string]json.RawMessage
		var block visualBlock
		if json.Unmarshal(raw, &fields) != nil || json.Unmarshal(raw, &block) != nil {
			add("blocks[%d]: not an object of the fields its type takes", i)
			continue
		}
		if !slices.Contains(visualBlockTypes, block.Type) {
			add("blocks[%d].type: unknown block type; use one of %s", i, strings.Join(visualBlockTypes, ", "))
			continue
		}
		for _, field := range visualRequired[block.Type] {
			if value, ok := fields[field]; !ok || bytes.Equal(value, []byte("null")) {
				add("blocks[%d].%s: required for a %s block", i, field, block.Type)
			}
		}
		if len(block.Series) > visualSeriesMax {
			add("blocks[%d].series: %d series; at most %d", i, len(block.Series), visualSeriesMax)
		}
		for s, series := range block.Series {
			if len(block.Labels) > 0 && len(series.Values) != len(block.Labels) {
				add("blocks[%d].series[%d].values: has %d values for %d labels; give one value per label",
					i, s, len(series.Values), len(block.Labels))
			}
		}
		for r, row := range block.Rows {
			if len(block.Columns) > 0 && len(row) != len(block.Columns) {
				add("blocks[%d].rows[%d]: has %d cells for %d columns", i, r, len(row), len(block.Columns))
			}
		}
	}
	if len(problems) > 8 {
		problems = problems[:8]
	}
	return problems
}

// SaveVisual keeps the entry for one visual a session's agent showed, beside
// its shared files (SharedDir), so the chat follows it the same way and the
// session's clean-up takes it. The spec is kept as the agent wrote it,
// compacted; CheckVisual is the caller's.
func SaveVisual(filesDir, sessionID string, spec []byte, now time.Time) (VisualEntry, error) {
	if !conversationPattern.MatchString(sessionID) {
		return VisualEntry{}, fmt.Errorf("session id %q", sessionID)
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, spec); err != nil {
		return VisualEntry{}, err
	}
	id, err := sharedID()
	if err != nil {
		return VisualEntry{}, err
	}
	entry := VisualEntry{
		Type: VisualEntryType, ID: id, Timestamp: now.UTC().Format(time.RFC3339Nano),
		Visual: compact.Bytes(),
	}
	encoded, err := json.Marshal(entry)
	if err != nil {
		return VisualEntry{}, err
	}
	if len(encoded) > SharedEntryMax {
		return VisualEntry{}, fmt.Errorf("visual: %d bytes as an entry; at most %d", len(encoded), SharedEntryMax)
	}
	dir := SharedDir(filesDir, sessionID)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return VisualEntry{}, err
	}
	temp, err := os.CreateTemp(dir, ".visual-*")
	if err != nil {
		return VisualEntry{}, err
	}
	defer func() { _ = os.Remove(temp.Name()) }()
	if _, err := temp.Write(encoded); err != nil {
		_ = temp.Close()
		return VisualEntry{}, err
	}
	if err := temp.Close(); err != nil {
		return VisualEntry{}, err
	}
	name := fmt.Sprintf("%020d-%s.json", now.UnixNano(), id)
	if err := os.Rename(temp.Name(), filepath.Join(dir, name)); err != nil {
		return VisualEntry{}, err
	}
	return entry, nil
}
