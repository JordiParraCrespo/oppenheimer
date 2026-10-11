//go:build !linux

package main

import (
	"fmt"
	"os"
)

// netsim needs network namespaces and TUN devices: Linux, as root.
func main() {
	fmt.Fprintln(os.Stderr, "netsim: Linux only (network namespaces and TUN devices)")
	os.Exit(1)
}
