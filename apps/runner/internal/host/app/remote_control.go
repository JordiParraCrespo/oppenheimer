package app

import (
	"errors"
	"fmt"

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

// SetRemoteControlPolicy saves it, for `runner remote-control`.
func (s *Service) SetRemoteControlPolicy(policy domain.RemoteControlPolicy) error {
	if s.remoteControlPolicy == nil {
		return errors.New("this runner keeps no remote control setting")
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
