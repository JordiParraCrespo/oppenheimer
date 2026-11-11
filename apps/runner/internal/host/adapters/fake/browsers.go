package fake

import (
	"context"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Browsers = (*Browsers)(nil)

// Browsers answers every action with Page, or Err, and records what it was
// asked.
type Browsers struct {
	Page domain.BrowserPage
	Err  error

	mu     sync.Mutex
	acted  []domain.BrowserRequest
	closed int
}

// CloseAll counts the call.
func (b *Browsers) CloseAll() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed++
}

// Closed is how many times CloseAll was called.
func (b *Browsers) Closed() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.closed
}

// Act records the request.
func (b *Browsers) Act(_ context.Context, req domain.BrowserRequest) (domain.BrowserPage, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.acted = append(b.acted, req)
	return b.Page, b.Err
}

// Available names a browser that is not there to start.
func (b *Browsers) Available() (string, error) { return "/usr/bin/fake-browser", nil }

// Acted is every request Act was given, in order.
func (b *Browsers) Acted() []domain.BrowserRequest {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]domain.BrowserRequest(nil), b.acted...)
}
