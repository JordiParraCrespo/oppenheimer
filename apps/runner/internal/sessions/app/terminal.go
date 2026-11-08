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
	session, err := s.created(ctx, id)
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
	// A drive that types waits for a match the typing caused: lines that
	// already matched before it, and the echo of what it typed, do not count.
	// One that only reads takes what is on the screen.
	echo := strings.TrimSpace(req.Text)
	typing := req.Text != "" || len(req.Keys) > 0
	before := 0
	if pattern != nil && typing {
		body, err := s.terminals.CaptureBody(ctx, target)
		if err != nil {
			return DriveResult{}, err
		}
		before = matches(body, pattern, echo)
	}
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
		matched, err = s.waitFor(ctx, target, pattern, echo, before, req.Wait)
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

// waitFor reads the screen until more of its lines match pattern than the
// before lines that matched before the drive typed, or wait runs out, and
// reports whether they did. A line holding echo, the text the drive typed,
// never counts: a command line that matches its own pattern is not output.
func (s *Service) waitFor(ctx context.Context, target string, pattern *regexp.Regexp, echo string, before int, wait time.Duration) (bool, error) {
	deadline := time.Now().Add(wait)
	for {
		body, err := s.terminals.CaptureBody(ctx, target)
		if err != nil {
			return false, err
		}
		if matches(body, pattern, echo) > before {
			return true, nil
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

// matches counts the lines of body that match pattern, leaving out any that
// holds echo.
func matches(body string, pattern *regexp.Regexp, echo string) int {
	count := 0
	for line := range strings.SplitSeq(body, "\n") {
		if echo != "" && strings.Contains(line, echo) {
			continue
		}
		if pattern.MatchString(line) {
			count++
		}
	}
	return count
}

// Waits a drive makes for a session that is not ready for it yet: one still
// being created (`open_terminal` answers once the create is sent, not done),
// and one this runner has not heard of yet (the create may still be on its
// way).
const (
	driveCreateWait  = 30 * time.Second
	driveUnknownWait = 5 * time.Second
)

// created is the session once its create has landed, waiting for one still
// being created or not yet arrived, within the waits above.
func (s *Service) created(ctx context.Context, id string) (domain.Session, error) {
	started := time.Now()
	for {
		session, err := s.recorded(id)
		if err == nil {
			return session, nil
		}
		s.mu.Lock()
		_, creating := s.creating[id]
		s.mu.Unlock()
		limit := driveUnknownWait
		if creating {
			limit = driveCreateWait
		}
		if time.Since(started) >= limit {
			return domain.Session{}, err
		}
		select {
		case <-ctx.Done():
			return domain.Session{}, ctx.Err()
		case <-time.After(drivePoll):
		}
	}
}
