package system

import (
	"context"
	"os/exec"
	"time"
)

// ClaudeHelp is what the host's `claude --help` prints, read to learn which
// flags the installed version takes before the runner launches it with one.
// It gives up after ten seconds.
func ClaudeHelp(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "claude", "--help").Output()
	return string(out), err
}
