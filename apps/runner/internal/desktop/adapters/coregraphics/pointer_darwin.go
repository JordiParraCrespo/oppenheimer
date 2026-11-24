//go:build darwin

// Package coregraphics reads where the macOS pointer is, for a desktop the
// console only watches: Apple's Screen Sharing never says (it neither paints
// the pointer into the framebuffer nor sends its position).
//
// The runner builds with CGO_ENABLED=0, so CoreGraphics is called through
// purego, which loads the framework with dlopen at run time. It is the only
// package allowed to import purego.
package coregraphics

import (
	"fmt"

	"github.com/ebitengine/purego"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/domain"
)

var _ app.PointerReader = (*Reader)(nil)

const (
	coreGraphicsPath   = "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
	coreFoundationPath = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation"
)

// cgPoint is CoreGraphics' CGPoint: two CGFloats, which are doubles on every
// Mac the runner ships for.
type cgPoint struct{ X, Y float64 }

// Reader reads the pointer through CoreGraphics.
type Reader struct {
	eventCreate      func(source uintptr) uintptr
	eventGetLocation func(event uintptr) cgPoint
	release          func(ref uintptr)
	mainDisplayID    func() uint32
	displayWide      func(display uint32) uintptr
	displayHigh      func(display uint32) uintptr
}

// New loads CoreGraphics; an error is a Mac without it, which shares its
// desktop without a pointer.
func New() (*Reader, error) {
	cg, err := purego.Dlopen(coreGraphicsPath, purego.RTLD_LAZY|purego.RTLD_GLOBAL)
	if err != nil {
		return nil, fmt.Errorf("load CoreGraphics: %w", err)
	}
	cf, err := purego.Dlopen(coreFoundationPath, purego.RTLD_LAZY|purego.RTLD_GLOBAL)
	if err != nil {
		return nil, fmt.Errorf("load CoreFoundation: %w", err)
	}
	r := &Reader{}
	for _, fn := range []struct {
		lib  uintptr
		ptr  any
		name string
	}{
		{cg, &r.eventCreate, "CGEventCreate"},
		{cg, &r.eventGetLocation, "CGEventGetLocation"},
		{cg, &r.mainDisplayID, "CGMainDisplayID"},
		{cg, &r.displayWide, "CGDisplayPixelsWide"},
		{cg, &r.displayHigh, "CGDisplayPixelsHigh"},
		{cf, &r.release, "CFRelease"},
	} {
		sym, err := purego.Dlsym(fn.lib, fn.name)
		if err != nil {
			return nil, fmt.Errorf("find %s: %w", fn.name, err)
		}
		purego.RegisterFunc(fn.ptr, sym)
	}
	return r, nil
}

// Pointer is where the pointer is, in points from the main display's top
// left corner (CGEventGetLocation's global coordinates), on the main display's
// size in points: CGDisplayPixelsWide counts the display mode's points, so a
// Retina screen of 1920 by 1080 points is 1920 wide here whatever its
// framebuffer. false is a session with no window server to ask.
func (r *Reader) Pointer() (domain.Pointer, bool) {
	event := r.eventCreate(0)
	if event == 0 {
		return domain.Pointer{}, false
	}
	at := r.eventGetLocation(event)
	r.release(event)
	display := r.mainDisplayID()
	wide, high := r.displayWide(display), r.displayHigh(display)
	if wide == 0 || high == 0 {
		return domain.Pointer{}, false
	}
	return domain.Pointer{X: at.X, Y: at.Y, Width: float64(wide), Height: float64(high)}, true
}
