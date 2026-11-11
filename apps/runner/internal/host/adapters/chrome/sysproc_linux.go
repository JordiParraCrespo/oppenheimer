//go:build linux

package chrome

import (
	"os/exec"
	"syscall"
)

// tieToRunner has the browser end when the runner does.
func tieToRunner(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGTERM}
}
