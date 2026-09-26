package app

import "runtime"

// arch is the GOARCH of the running binary, which is also the architecture
// half of a release target.
func arch() string { return runtime.GOARCH }

// cpus is how many logical CPUs this process may use: the affinity mask on
// Linux, so a runner in a cgroup-limited box reports what it actually gets.
func cpus() int { return runtime.NumCPU() }
