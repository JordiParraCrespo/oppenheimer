package system

import (
	"encoding/json"
	"os"
	"strings"
)

// ClaudeAccount reads the claude.ai account Claude Code is signed in as from
// its global state file (`~/.claude.json`, or the one under
// `$CLAUDE_CONFIG_DIR`): `oauthAccount.emailAddress`. Only that one field is
// read and kept. A file that is missing, unreadable or names no account
// answers "", which is "not signed in" to the control plane.
func ClaudeAccount(configPath string) string {
	if configPath == "" {
		return ""
	}
	raw, err := os.ReadFile(configPath) //nolint:gosec // Claude Code's own state file in the runner account's home
	if err != nil {
		return ""
	}
	var state struct {
		OAuthAccount *struct {
			EmailAddress string `json:"emailAddress"`
		} `json:"oauthAccount"`
	}
	if json.Unmarshal(raw, &state) != nil || state.OAuthAccount == nil {
		return ""
	}
	return strings.TrimSpace(state.OAuthAccount.EmailAddress)
}
