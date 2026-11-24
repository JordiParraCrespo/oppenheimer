//go:build !linux && !darwin

package desktop

import "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/app"

// New answers nil: the runner drives no screen on this platform.
func New(Options) app.Desktop { return nil }
