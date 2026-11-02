package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
)

// statusLineTimeout bounds the person's own status line command: Claude Code
// cancels a slow one anyway when the next update comes.
const statusLineTimeout = 5 * time.Second

// statusLinePayloadMax bounds what is read of Claude Code's payload.
const statusLinePayloadMax = 256 << 10

// statusLineNested marks the person's own status line as run by the
// runner's. A `runner statusline` that finds it set is inside one (their
// settings name the runner's own, copied from a session), so it draws its
// line instead of running theirs again.
const statusLineNested = "OPPENHEIMER_STATUSLINE"

// StatusLine is `runner statusline`, the status line a session's Claude Code
// runs (domain.Launch.StatusLine). It keeps the figures the CLI hands it for
// the chat (transcript.SaveStatus), then draws the line: the person's own
// status line when they have one, run on the same payload, or the context
// and the plan's usage. It never fails the CLI: whatever goes wrong, the
// line is just shorter.
func StatusLine(ctx context.Context, in io.Reader, out io.Writer) error {
	payload, _ := io.ReadAll(io.LimitReader(in, statusLinePayloadMax))
	paths, err := ResolvePaths()
	if err != nil {
		return nil //nolint:nilerr // a status line has nowhere to report to
	}
	status, _ := transcript.SaveStatus(StatusDir(paths), payload)
	if os.Getenv(statusLineNested) == "" {
		if command, dir := ownStatusLine(paths.UserHome, payload); command != "" {
			runStatusLine(ctx, command, dir, payload, out)
			return nil
		}
	}
	if text := status.Text(); text != "" {
		_, _ = fmt.Fprintln(out, text)
	}
	return nil
}

// StatusDir is where `runner statusline` keeps each conversation's status
// for the chat follower.
func StatusDir(paths Paths) string {
	return filepath.Join(paths.State(), "statusline")
}

// statusLineCommand is the command a session's Claude Code runs for its
// status line: this binary's `statusline`, quoted for the shell Claude Code
// runs it in.
func statusLineCommand() string {
	executable, err := os.Executable()
	if err != nil {
		return ""
	}
	return "'" + strings.ReplaceAll(executable, "'", `'\''`) + "' statusline"
}

// ownStatusLine is the status line the person configured, which the
// runner's would otherwise hide, and the folder to run it in: the project's
// local settings, then the project's, then their own, the order Claude Code
// reads them in.
func ownStatusLine(userHome string, payload []byte) (command, dir string) {
	var in struct {
		Cwd       string `json:"cwd"`
		Workspace struct {
			ProjectDir string `json:"project_dir"`
			CurrentDir string `json:"current_dir"`
		} `json:"workspace"`
	}
	_ = json.Unmarshal(payload, &in)
	dir = in.Workspace.CurrentDir
	if dir == "" {
		dir = in.Cwd
	}
	project := in.Workspace.ProjectDir
	if project == "" {
		project = dir
	}
	configDir := os.Getenv("CLAUDE_CONFIG_DIR")
	if configDir == "" && userHome != "" {
		configDir = filepath.Join(userHome, ".claude")
	}
	var files []string
	if project != "" {
		files = append(files,
			filepath.Join(project, ".claude", "settings.local.json"),
			filepath.Join(project, ".claude", "settings.json"))
	}
	if configDir != "" {
		files = append(files, filepath.Join(configDir, "settings.json"))
	}
	for _, file := range files {
		raw, err := os.ReadFile(file) //nolint:gosec // Claude Code's own settings files, read as Claude Code reads them
		if err != nil {
			continue
		}
		var settings struct {
			StatusLine *struct {
				Type    string `json:"type"`
				Command string `json:"command"`
			} `json:"statusLine"`
		}
		if json.Unmarshal(raw, &settings) != nil || settings.StatusLine == nil {
			continue
		}
		line := settings.StatusLine
		if line.Type != "command" || strings.TrimSpace(line.Command) == "" {
			continue
		}
		return line.Command, dir
	}
	return "", dir
}

// runStatusLine runs the person's status line command on the payload, as
// Claude Code would, and passes on what it prints.
func runStatusLine(ctx context.Context, command, dir string, payload []byte, out io.Writer) {
	ctx, cancel := context.WithTimeout(ctx, statusLineTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "sh", "-c", command) //nolint:gosec // the person's own status line, from their own settings
	cmd.Stdin = bytes.NewReader(payload)
	cmd.Stdout = out
	cmd.Env = append(os.Environ(), statusLineNested+"=1")
	if dir != "" {
		cmd.Dir = dir
	}
	_ = cmd.Run()
}
