//go:build darwin || linux

package git

import (
	"os/exec"
	"syscall"
)

// killGroupOnCancel runs git in a process group of its own and, when its
// context ends, kills the group rather than git alone. git hands the network
// to helpers (`git-remote-https`, `ssh`) that inherit its output; killing
// only git would leave them running, holding that output open, and the
// command would not return until they gave up by themselves.
func killGroupOnCancel(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
}
