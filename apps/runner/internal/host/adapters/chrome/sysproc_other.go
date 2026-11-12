//go:build !linux

package chrome

import (
	"os/exec"
	"syscall"
)

// tieToRunner gives the browser a process group of its own. Where the
// kernel cannot end it with the runner, the next start for the same bot ends
// what was left (see instance.start).
func tieToRunner(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}
