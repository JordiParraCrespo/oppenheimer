// Package app holds the host inventory use case and the ports it needs. The
// ports exist so the use case can be tested without a machine: every call
// that touches the operating system goes through Prober.
package app

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// Prober is the operating system, as much of it as this context needs.
type Prober interface {
	// Platform identifies the host family and its version string.
	Platform(ctx context.Context) (domain.Platform, string, error)
	// Tool locates an executable and reads its version. A tool that is not
	// on PATH is returned with an empty Path and no error: absence is an
	// answer, not a failure.
	Tool(ctx context.Context, name string) domain.Tool
	// Identity reports who the runner runs as.
	Identity() (user, home, hostname string, root bool)
	// DiskFree reports free bytes on the filesystem holding path. It takes
	// the nearest existing ancestor when the path is not there yet.
	DiskFree(path string) (uint64, error)
	// DiskTotal reports the size of the filesystem holding path, resolved the
	// same way DiskFree resolves it.
	DiskTotal(path string) (uint64, error)
	// Machine reports what the operating system says about the hardware and
	// itself. Fields it cannot read are left empty; it never fails.
	Machine(ctx context.Context) domain.Machine
}
