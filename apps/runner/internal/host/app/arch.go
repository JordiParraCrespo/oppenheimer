package app

import "runtime"

// arch is the GOARCH of the running binary, which is also the architecture
// half of a release target.
func arch() string { return runtime.GOARCH }
