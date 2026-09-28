//go:build !unix

package execx

import "os/exec"

// killGroupOnCancel is a no-op without process groups: the command alone is
// killed, and WaitDelay still bounds the wait for its output.
func killGroupOnCancel(*exec.Cmd) {}
