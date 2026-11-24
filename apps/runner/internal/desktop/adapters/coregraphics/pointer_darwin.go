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
// Mac the runner ships for. cgRect is its CGRect.
type (
	cgPoint struct{ X, Y float64 }
	cgRect  struct{ Origin, Size cgPoint }
)

// Reader reads the pointer through CoreGraphics.
type Reader struct {
	eventCreate      func(source uintptr) uintptr
	eventGetLocation func(event uintptr) cgPoint
	release          func(ref uintptr)
	activeDisplays   func(maxDisplays uint32, displays *uint32, count *uint32) int32
	displayBounds    func(display uint32) cgRect
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
		{cg, &r.activeDisplays, "CGGetActiveDisplayList"},
		{cg, &r.displayBounds, "CGDisplayBounds"},
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

// Pointer is where the pointer is, in points from the display's top left
// corner, on the display's size in points: CGEventGetLocation and
// CGDisplayBounds share one global space of points, so a Retina screen of
// 1920 by 1080 points is 1920 wide here whatever its framebuffer.
//
// Only on a Mac with one display. With several, Screen Sharing may send one
// framebuffer that spans them all, laid out and scaled in ways this cannot
// see, and a pointer drawn in the wrong place is worse than none; so it
// answers false, as it does for a session with no window server to ask.
func (r *Reader) Pointer() (domain.Pointer, bool) {
	var displays [2]uint32
	var count uint32
	if r.activeDisplays(uint32(len(displays)), &displays[0], &count) != 0 || count != 1 {
		return domain.Pointer{}, false
	}
	bounds := r.displayBounds(displays[0])
	if bounds.Size.X <= 0 || bounds.Size.Y <= 0 {
		return domain.Pointer{}, false
	}
	event := r.eventCreate(0)
	if event == 0 {
		return domain.Pointer{}, false
	}
	at := r.eventGetLocation(event)
	r.release(event)
	return domain.Pointer{
		X: at.X - bounds.Origin.X, Y: at.Y - bounds.Origin.Y,
		Width: bounds.Size.X, Height: bounds.Size.Y,
	}, true
}
