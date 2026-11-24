//go:build !darwin

package coregraphics

import (
	"errors"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

// Reader is CoreGraphics' pointer, which only a Mac has. A Linux server that
// shares its desktop (x11vnc, TigerVNC) can draw its own pointer.
type Reader struct{}

// New reports that there is no CoreGraphics here.
func New() (*Reader, error) { return nil, errors.ErrUnsupported }

// Pointer is never read: New returns no Reader.
func (*Reader) Pointer() (domain.Pointer, bool) { return domain.Pointer{}, false }
