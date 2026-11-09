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
	// A drive that types waits for a match its typing caused, so it keeps
	// the screen as it was before (see fresh). One that only reads takes what
	// is on the screen.
	echo := strings.TrimSpace(req.Text)
	typing := req.Text != "" || len(req.Keys) > 0
	var before []string
	if pattern != nil && typing {
		body, err := s.terminals.CaptureBody(ctx, target)
		if err != nil {
			return DriveResult{}, err
		}
		before = strings.Split(body, "\n")
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
		matched, err = s.waitFor(ctx, target, pattern, echo, typing, before, req.Wait)
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

// waitFor reads the screen until pattern matches a line of it that counts,
// or wait runs out, and reports whether one did. For a drive that only reads
// every line counts; for one that typed, only the lines fresh says are new.
func (s *Service) waitFor(ctx context.Context, target string, pattern *regexp.Regexp, echo string, typing bool, before []string, wait time.Duration) (bool, error) {
	deadline := time.Now().Add(wait)
	for {
		body, err := s.terminals.CaptureBody(ctx, target)
		if err != nil {
			return false, err
		}
		lines := strings.Split(body, "\n")
		if typing {
			lines = fresh(lines, before, echo)
		}
		for _, line := range lines {
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

// fresh is the part of the screen a drive's typing produced: the lines after
// the last one that shows what it typed (the command line, then its output
// and the prompt that follows), or, when no line shows it (keys only, input a
// program does not echo, a command line scrolled away), the lines from the
// first one that differs from the screen before it typed. Either way a match
// that was already there, or the echoed command line itself, is not the
// answer to what was typed.
func fresh(lines, before []string, echo string) []string {
	if echo != "" {
		for i := len(lines) - 1; i >= 0; i-- {
			if strings.Contains(lines[i], echo) {
				return lines[i+1:]
			}
		}
	}
	for i, line := range lines {
		if i >= len(before) || line != before[i] {
			return lines[i:]
		}
	}
	return nil
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
