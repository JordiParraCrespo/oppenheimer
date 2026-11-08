package app_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// noDevice is the refusal the console shows as "No device for this session".
func noDevice(err error) bool {
	var p *problem.Error
	return errors.As(err, &p) && p.Code == domain.ErrNoDevice.Code
}

type finder struct {
	devices []domain.Device
	err     error
}

func (f *finder) Find(context.Context) ([]domain.Device, error) { return f.devices, f.err }

// A host that names no devices offers what it has running when a session
// asks: a simulator booted after the runner started is handed out, one the
// session holds stays its own when it drops off the list (a reboot), and a
// failed look does not take every device away.
func TestDiscoveredDevicesAreOfferedAsTheyAppear(t *testing.T) {
	found := &finder{}
	service := app.New(app.Options{Finder: found})
	if _, err := service.ForSession("s1"); !noDevice(err) {
		t.Fatalf("a host with nothing running gave a device: %v", err)
	}

	sim := domain.Device{Serial: "UDID-1", Name: "iPhone 17", Platform: domain.IOS}
	found.devices = []domain.Device{sim}
	got, err := service.ForSession("s1")
	if err != nil || got != sim {
		t.Fatalf("a simulator booted later was not offered: %+v %v", got, err)
	}

	found.devices = nil
	if again, err := service.ForSession("s1"); err != nil || again != sim {
		t.Fatalf("a session lost its device when it dropped off the list: %+v %v", again, err)
	}
	if _, err := service.ForSession("s2"); !noDevice(err) {
		t.Fatalf("a second session took a held device: %v", err)
	}

	service.Release("s1")
	found.devices, found.err = []domain.Device{sim}, nil
	if _, err := service.ForSession("s2"); err != nil {
		t.Fatal(err)
	}
	found.err = errors.New("simctl hung")
	if got, err := service.ForSession("s2"); err != nil || got != sim {
		t.Fatalf("a failed look took the device away: %+v %v", got, err)
	}
}

type blockingFinder struct {
	started chan struct{}
	proceed chan struct{}
	devices []domain.Device
}

func (f *blockingFinder) Find(context.Context) ([]domain.Device, error) {
	close(f.started)
	<-f.proceed
	return f.devices, nil
}

// A session that closes while its device is being looked for is not handed
// one when the look returns: it would hold that device until the runner
// restarts, and no other session could take it.
func TestASessionThatClosesMidLookIsNotHandedADevice(t *testing.T) {
	sim := domain.Device{Serial: "UDID-1", Name: "iPhone 17", Platform: domain.IOS}
	found := &blockingFinder{started: make(chan struct{}), proceed: make(chan struct{}), devices: []domain.Device{sim}}
	service := app.New(app.Options{Finder: found})

	done := make(chan error, 1)
	go func() {
		_, err := service.ForSession("s1")
		done <- err
	}()
	<-found.started
	service.Release("s1")
	close(found.proceed)
	if err := <-done; !noDevice(err) {
		t.Fatalf("a closed session was handed a device: %v", err)
	}

	service = app.New(app.Options{Devices: []domain.Device{sim}})
	if got, err := service.ForSession("s2"); err != nil || got != sim {
		t.Fatalf("the device was not free for the next session: %+v %v", got, err)
	}
}
