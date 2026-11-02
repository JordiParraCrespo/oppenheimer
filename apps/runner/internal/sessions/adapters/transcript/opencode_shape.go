package transcript

import "time"

// How OpenCode's conversation is made to read as the transcript the chat
// already draws (`claude_chat.go`): its times, and its tools and their
// fields under the names the chat knows them by.

// openCodeStamp is a time OpenCode keeps in Unix milliseconds as the chat
// reads one; "" for none.
func openCodeStamp(ms int64) string {
	if ms <= 0 {
		return ""
	}
	return time.UnixMilli(ms).UTC().Format(time.RFC3339Nano)
}

// openCodeTools are OpenCode's tools by the names the chat knows them by.
var openCodeTools = map[string]string{
	"bash":      "Bash",
	"read":      "Read",
	"edit":      "Edit",
	"multiedit": "MultiEdit",
	"write":     "Write",
	"glob":      "Glob",
	"grep":      "Grep",
	"list":      "LS",
	"todowrite": "TodoWrite",
	"webfetch":  "WebFetch",
	"websearch": "WebSearch",
	"task":      "Task",
}

// openCodeFields are the input fields OpenCode spells its own way, by the
// names the chat reads.
var openCodeFields = map[string]string{
	"filePath":   "file_path",
	"oldString":  "old_string",
	"newString":  "new_string",
	"replaceAll": "replace_all",
}

// openCodeTool is a call's tool and input as the chat reads them: a tool it
// knows by its name there and its fields renamed, any other as it came.
func openCodeTool(name string, input any) (string, any) {
	known, ok := openCodeTools[name]
	if !ok {
		return name, input
	}
	return known, renameFields(input)
}

func renameFields(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			if renamed, ok := openCodeFields[key]; ok {
				key = renamed
			}
			out[key] = renameFields(item)
		}
		return out
	case []any:
		for i, item := range v {
			v[i] = renameFields(item)
		}
		return v
	}
	return value
}
