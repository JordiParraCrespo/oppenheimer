package fake

import (
	"context"
	"image"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

var _ app.Desktop = (*Desktop)(nil)

// Desktop is a screen of a size you set that records what was done to it.
type Desktop struct {
	Size domain.Screen
	// Pixels is the size the screen is captured at; zero is Size (a Retina
	// screen is captured at twice its points).
	Pixels image.Point
	// ScreenErr, when set, is what Screen answers.
	ScreenErr error

	mu    sync.Mutex
	acted []domain.ComputerRequest
}

// Screen answers Size, or ScreenErr.
func (d *Desktop) Screen(context.Context) (domain.Screen, error) {
	return d.Size, d.ScreenErr
}

// Capture answers a blank image.
func (d *Desktop) Capture(context.Context) (image.Image, error) {
	size := d.Pixels
	if size == (image.Point{}) {
		size = image.Pt(d.Size.Width, d.Size.Height)
	}
	return image.NewGray(image.Rect(0, 0, size.X, size.Y)), nil
}

// Act records the request.
func (d *Desktop) Act(_ context.Context, req domain.ComputerRequest) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.acted = append(d.acted, req)
	return nil
}

// Acted is every request Act was given, in order.
func (d *Desktop) Acted() []domain.ComputerRequest {
	d.mu.Lock()
	defer d.mu.Unlock()
	return append([]domain.ComputerRequest(nil), d.acted...)
}
