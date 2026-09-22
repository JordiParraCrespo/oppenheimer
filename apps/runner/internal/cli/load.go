package cli

import (
	"os"
	"strconv"
	"strings"
)

// loadAverage reads the one-minute load where the kernel publishes it. Zero
// where it does not: the heartbeat's load is advisory and never a refusal.
func loadAverage() float64 {
	raw, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(raw))
	if len(fields) == 0 {
		return 0
	}
	value, err := strconv.ParseFloat(fields[0], 64)
	if err != nil || value < 0 {
		return 0
	}
	return value
}
