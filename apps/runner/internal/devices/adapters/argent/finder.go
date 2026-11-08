package argent

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

// Finder lists the simulators and emulators running on this host: the iOS
// simulators simctl reports booted, and the Android emulators adb sees. A
// device that is not running is not offered: booting one is the person's
// call, or their agent's.
type Finder struct {
	// ADB is the adb binary; empty is "adb" on PATH.
	ADB string
}

var _ app.Finder = Finder{}

// Find asks simctl and adb; a tool that is missing offers nothing, and only
// both failing is an error.
func (f Finder) Find(ctx context.Context) ([]domain.Device, error) {
	var devices []domain.Device
	var failed []error
	if runtime.GOOS == "darwin" {
		out, err := run(ctx, true, "xcrun", "simctl", "list", "devices", "booted", "-j")
		if err == nil {
			found, perr := parseSimctl(out)
			devices = append(devices, found...)
			err = perr
		}
		if err != nil {
			failed = append(failed, err)
		}
	}
	adb := f.ADB
	if adb == "" {
		adb = "adb"
	}
	// Not killed as a group: `adb devices` may start adb's server, which is
	// meant to outlive it.
	out, err := run(ctx, false, adb, "devices")
	if err == nil {
		for _, serial := range parseADB(out) {
			devices = append(devices, domain.Device{Serial: serial, Name: avdName(ctx, adb, serial), Platform: domain.Android})
		}
	} else {
		failed = append(failed, err)
	}
	if len(devices) == 0 && len(failed) > 0 && (runtime.GOOS != "darwin" || len(failed) == 2) {
		return nil, errors.Join(failed...)
	}
	return devices, nil
}

// run is one look at the host's devices: stdout only, and bounded even when a
// helper the tool started keeps its output open.
func run(ctx context.Context, killGroup bool, name string, args ...string) ([]byte, error) {
	res, err := execx.Run(ctx, execx.Spec{
		Name: name, Args: args, Output: execx.Stdout, KillGroup: killGroup, WaitDelay: time.Second,
	})
	return []byte(res.Out), err
}

// parseSimctl reads `simctl list devices booted -j`: every booted simulator,
// in a stable order so sessions are handed them predictably.
func parseSimctl(out []byte) ([]domain.Device, error) {
	var list struct {
		Devices map[string][]struct {
			UDID  string `json:"udid"`
			Name  string `json:"name"`
			State string `json:"state"`
		} `json:"devices"`
	}
	if err := json.Unmarshal(out, &list); err != nil {
		return nil, err
	}
	runtimes := make([]string, 0, len(list.Devices))
	for name := range list.Devices {
		runtimes = append(runtimes, name)
	}
	slices.Sort(runtimes)
	var devices []domain.Device
	for _, name := range runtimes {
		for _, sim := range list.Devices[name] {
			if sim.State != "Booted" || sim.UDID == "" {
				continue
			}
			devices = append(devices, domain.Device{Serial: sim.UDID, Name: sim.Name, Platform: domain.IOS})
		}
	}
	return devices, nil
}

// parseADB reads `adb devices`: the emulators that are up. A phone on USB
// is the person's own and is not offered; an emulator still booting
// (`offline`) or not yet authorised is not ready to be watched.
func parseADB(out []byte) []string {
	var serials []string
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 || fields[1] != "device" || !strings.HasPrefix(fields[0], "emulator-") {
			continue
		}
		serials = append(serials, fields[0])
	}
	return serials
}

// avdName is the emulator's AVD, Pixel_7_API_35 read as "Pixel 7 API 35".
func avdName(ctx context.Context, adb, serial string) string {
	out, err := run(ctx, true, adb, "-s", serial, "emu", "avd", "name")
	if err != nil {
		return "Android emulator"
	}
	name, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
	name = strings.TrimSpace(strings.ReplaceAll(name, "_", " "))
	if name == "" || name == "OK" {
		return "Android emulator"
	}
	return name
}
