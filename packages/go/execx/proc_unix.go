//go:build unix

package execx

import (
	"os/exec"
	"syscall"
)

// killGroupOnCancel runs the command in a process group of its own and, when
// its context ends, kills the group rather than the command alone. A command
// that hands work to helpers (git's `git-remote-https` and `ssh`) passes them
// its output; killing only the command would leave them running, holding that
// output open, and the call would not return until they gave up by themselves.
func killGroupOnCancel(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
}

// killGroup kills every process left in the group led by pid. A group with
// nobody left in it is not an error.
func killGroup(pid int) {
	_ = syscall.Kill(-pid, syscall.SIGKILL)
}
