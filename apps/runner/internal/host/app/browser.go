package app

import (
	"context"
	"errors"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// BrowserPolicy is whether the host lets bots drive a browser, as enforced.
func (s *Service) BrowserPolicy() (domain.BrowserPolicy, error) {
	if s.browserPolicy == nil {
		return domain.BrowserPolicy{}, nil
	}
	policy, err := s.browserPolicy.Load()
	if err != nil {
		return domain.BrowserPolicy{}, domain.ErrBrowserPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return policy, nil
}

// SetBrowserPolicy saves it, for `runner browser`.
func (s *Service) SetBrowserPolicy(policy domain.BrowserPolicy) error {
	if s.browserPolicy == nil {
		return domain.ErrBrowserPolicyFile.WithDetail("this runner keeps no browser setting")
	}
	if err := s.browserPolicy.Save(policy); err != nil {
		return domain.ErrBrowserPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

// BrowserAvailable is the browser bots would get, for `runner browser`: its
// program, or why there is none.
func (s *Service) BrowserAvailable() (string, error) {
	if s.browsers == nil {
		return "", domain.ErrBrowserMissing.WithDetail("the runner starts no browser on this platform")
	}
	program, err := s.browsers.Available()
	if err != nil {
		return "", browserProblem(err)
	}
	return program, nil
}

// Browser does one action in a bot's browser and answers with the page after
// it (`browser.act`, 25 §4.2). The setting is read from disk on every call,
// so `runner browser off` stops the next action without a restart, and it is
// checked before anything is started.
func (s *Service) Browser(ctx context.Context, req domain.BrowserRequest) (domain.BrowserPage, error) {
	policy, err := s.BrowserPolicy()
	if err != nil {
		return domain.BrowserPage{}, err
	}
	if !policy.Enabled {
		// Off also closes what was open when it was turned off.
		if s.browsers != nil {
			s.browsers.CloseAll()
		}
		return domain.BrowserPage{}, domain.ErrBrowserOff.WithDetail(
			"the person on this host can turn it on with `runner browser on`")
	}
	if s.browsers == nil {
		return domain.BrowserPage{}, domain.ErrBrowserMissing.WithDetail("the runner starts no browser on this platform")
	}
	if err := req.Validate(); err != nil {
		return domain.BrowserPage{}, domain.ErrBrowserAction.WithDetail("%v", err).WithCause(err)
	}
	page, err := s.browsers.Act(ctx, req)
	if err != nil {
		return domain.BrowserPage{}, browserProblem(err)
	}
	return page, nil
}

func browserProblem(err error) error {
	switch {
	case errors.Is(err, domain.ErrNoBrowser):
		return domain.ErrBrowserMissing.WithDetail("%v", err).WithCause(err)
	case errors.Is(err, domain.ErrBrowserRef), errors.Is(err, domain.ErrBrowserNotOpen),
		errors.Is(err, domain.ErrBrowserActionShape), errors.Is(err, domain.ErrComputerKey):
		return domain.ErrBrowserAction.WithDetail("%v", err).WithCause(err)
	}
	return domain.ErrBrowserFailed.WithDetail("%v", err).WithCause(err)
}
