package app

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// RemoteControlPolicy is whether Claude Code sessions here register with
// Remote Control.
func (s *Service) RemoteControlPolicy() (domain.RemoteControlPolicy, error) {
	if s.remoteControlPolicy == nil {
		return domain.RemoteControlPolicy{}, nil
	}
	policy, err := s.remoteControlPolicy.Load()
	if err != nil {
		return domain.RemoteControlPolicy{}, fmt.Errorf("the host's remote control setting cannot be read: %w", err)
	}
	return policy, nil
}

// SetRemoteControlPolicy saves it, for `runner remote-control`. Turning it
// on asks the host's `claude` first: a version that does not take
// `--remote-control` exits on it, which would fail every Claude Code session
// here.
func (s *Service) SetRemoteControlPolicy(ctx context.Context, policy domain.RemoteControlPolicy) error {
	if s.remoteControlPolicy == nil {
		return errors.New("this runner keeps no remote control setting")
	}
	if policy.Enabled {
		if s.claudeHelp == nil {
			return errors.New("this runner cannot ask claude which flags it takes")
		}
		help, err := s.claudeHelp(ctx)
		if err != nil {
			return fmt.Errorf("claude --help failed (%w); is Claude Code installed? (runner agents install claude)", err)
		}
		if !strings.Contains(help, "--remote-control") {
			return errors.New("this host's claude has no --remote-control; update it (runner agents install claude) and try again")
		}
	}
	if err := s.remoteControlPolicy.Save(policy); err != nil {
		return fmt.Errorf("the host's remote control setting cannot be written: %w", err)
	}
	return nil
}

// ClaudeAccount is the claude.ai account the host's `claude` is signed in as,
// "" when none: the account Remote Control registers sessions under.
func (s *Service) ClaudeAccount() string {
	if s.account == nil {
		return ""
	}
	return s.account()
}
