package domain

// Pointer is where the host's pointer is, in the screen's own units (points
// on macOS), on a screen Width by Height of them. The console maps it onto the
// framebuffer the server sends, whatever its resolution; a pointer on another
// display falls outside the screen.
type Pointer struct {
	X, Y          float64
	Width, Height float64
}

// PointerTrail decides which of the pointer's readings a watching browser is
// sent: one when it moved, none while the browser is in control (its own
// pointer is the host's then), and the current one again as soon as it goes
// back to watching, since it stopped hearing while it drove.
//
// Next is called from one goroutine.
type PointerTrail struct {
	last Pointer
	sent bool
}

// Next takes a reading and whether the browser is in control now, and says
// whether to send it.
func (p *PointerTrail) Next(reading Pointer, control bool) bool {
	if control {
		p.sent = false
		return false
	}
	if p.sent && reading == p.last {
		return false
	}
	p.last, p.sent = reading, true
	return true
}
