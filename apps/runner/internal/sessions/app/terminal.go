package app

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// drivePoll is how often a drive waiting for its pattern reads the screen.
const drivePoll = 200 * time.Millisecond

// DriveRequest is one `terminal.drive`: what to type into a blank terminal,
// and how to wait before reading its screen.
type DriveRequest struct {
	Window int
	// Text is typed literally; Keys are then pressed by name.
	Text string
	Keys []string
	// WaitFor, when set, is an RE2 pattern the drive waits to see on a line
	// of the screen, for at most Wait. Without it the drive waits Wait.
	WaitFor string
	Wait    time.Duration
	// History is how many lines above the visible screen to read back.
	History int
}

// DriveResult is the screen a drive left, and whether its pattern showed.
type DriveResult struct {
	Screen  string
	Matched bool
	Waited  time.Duration
}

// Drive types into a blank-terminal session and reads its screen back
// (`terminal.drive`, 25 §4.2). Only a session whose window 0 is a plain shell
// takes it: a bot drives a terminal it opened for that, never an agent's
// prompt, which has its own verbs. Whether the host lets a bot drive a shell
// at all is the host's exec policy, checked by the caller.
func (s *Service) Drive(ctx context.Context, id string, req DriveRequest) (DriveResult, error) {
	session, err := s.recorded(id)
	if err != nil {
		return DriveResult{}, err
	}
	if session.Agent != domain.AgentShell {
		return DriveResult{}, domain.ErrNotTerminal.WithDetail("session %s runs %s", id, session.Agent)
	}
	if !session.State.Live() {
		return DriveResult{}, domain.ErrNotRunning.WithDetail("session %s is %s", id, session.State)
	}
	var pattern *regexp.Regexp
	if req.WaitFor != "" {
		if pattern, err = regexp.Compile(req.WaitFor); err != nil {
			return DriveResult{}, domain.ErrInvalidPattern.WithDetail("%v", err).WithCause(err)
		}
	}

	target := session.Target(req.Window)
	if req.Text != "" {
		if err := s.terminals.SendKeys(ctx, target, req.Text); err != nil {
			return DriveResult{}, err
		}
	}
	if err := s.terminals.PressKeys(ctx, target, req.Keys); err != nil {
		return DriveResult{}, err
	}

	started := time.Now()
	matched := false
	if pattern == nil {
		if req.Wait > 0 {
			select {
			case <-ctx.Done():
				return DriveResult{}, ctx.Err()
			case <-time.After(req.Wait):
			}
		}
	} else {
		matched, err = s.waitFor(ctx, target, pattern, req.Wait)
		if err != nil {
			return DriveResult{}, err
		}
	}
	screen, err := s.terminals.CaptureHistory(ctx, target, req.History)
	if err != nil {
		return DriveResult{}, err
	}
	return DriveResult{Screen: strings.TrimRight(screen, "\n"), Matched: matched, Waited: time.Since(started)}, nil
}

// waitFor reads the screen until a line of it matches pattern or wait runs
// out, and reports whether it matched.
func (s *Service) waitFor(ctx context.Context, target string, pattern *regexp.Regexp, wait time.Duration) (bool, error) {
	deadline := time.Now().Add(wait)
	for {
		body, err := s.terminals.CaptureBody(ctx, target)
		if err != nil {
			return false, err
		}
		for line := range strings.SplitSeq(body, "\n") {
			if pattern.MatchString(line) {
				return true, nil
			}
		}
		if !time.Now().Before(deadline) {
			return false, nil
		}
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-time.After(drivePoll):
		}
	}
}
