package system

import (
	"context"
	"errors"
	"os/exec"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Executor = Executor{}

// Executor runs a bot's program with execx: argv as given, no shell, the
// runner's own environment, the whole process group killed at the timeout.
type Executor struct{}

// Run runs req to completion. A program that ran and failed is a result;
// only one that could not be started at all is an error.
func (Executor) Run(ctx context.Context, req domain.ExecRequest) (domain.ExecResult, error) {
	started := time.Now()
	res, err := execx.Run(ctx, execx.Spec{
		Name: req.Argv[0], Args: req.Argv[1:], Dir: req.Dir,
		Timeout: req.Timeout, KillGroup: true, Output: execx.Separate, Limit: req.Limit,
	})
	result := domain.ExecResult{
		Stdout: res.Out, Stderr: res.Stderr,
		StdoutTruncated: res.OutTruncated, StderrTruncated: res.StderrTruncated,
		Duration: time.Since(started),
	}
	if err == nil {
		code := 0
		result.ExitCode = &code
		return result, nil
	}
	var failed *execx.Error
	if errors.As(err, &failed) && failed.TimedOut {
		result.TimedOut = true
		return result, nil
	}
	var exited *exec.ExitError
	if errors.As(err, &exited) {
		if code := exited.ExitCode(); code >= 0 {
			result.ExitCode = &code
		}
		return result, nil
	}
	if errors.Is(err, exec.ErrWaitDelay) {
		// It exited, but something it left behind held the output open.
		code := 0
		result.ExitCode = &code
		return result, nil
	}
	return domain.ExecResult{}, execx.Cause(err)
}
