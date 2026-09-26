package system_test

import (
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
)

func TestMeminfoBytes(t *testing.T) {
	meminfo := "MemTotal:       32768000 kB\nMemFree:         1000000 kB\nMemAvailable:   20000000 kB\n"
	if got := system.MeminfoBytes(meminfo, "MemTotal"); got != 32768000*1024 {
		t.Fatalf("MemTotal = %d", got)
	}
	if got := system.MeminfoBytes(meminfo, "MemAvailable"); got != 20000000*1024 {
		t.Fatalf("MemAvailable = %d", got)
	}
	if got := system.MeminfoBytes(meminfo, "SwapTotal"); got != 0 {
		t.Fatalf("a missing field reads as unknown, got %d", got)
	}
}

func TestBootTime(t *testing.T) {
	booted, ok := system.BootTime("cpu  1 2 3\nbtime 1727000000\nprocesses 42\n")
	if !ok || !booted.Equal(time.Unix(1727000000, 0)) {
		t.Fatalf("BootTime = %v, %v", booted, ok)
	}
	if _, ok := system.BootTime("cpu 1 2 3\n"); ok {
		t.Fatal("no btime line is unknown, not the epoch")
	}
}
