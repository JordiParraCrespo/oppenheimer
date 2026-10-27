package domain_test

import (
	"errors"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

func TestParseDevicesReadsSerialsNamesAndPlatforms(t *testing.T) {
	got, err := domain.ParseDevices(" emulator-5554=Pixel 4 , 8F2A-UDID ,")
	if err != nil {
		t.Fatal(err)
	}
	want := []domain.Device{
		{Serial: "emulator-5554", Name: "Pixel 4", Platform: domain.Android},
		{Serial: "8F2A-UDID", Name: "iOS simulator", Platform: domain.IOS},
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	if _, err := domain.ParseDevices("emulator-5554,emulator-5554"); err == nil {
		t.Fatal("a device listed twice would be handed to two sessions")
	}
}

func TestEachSessionKeepsItsOwnDevice(t *testing.T) {
	pool := domain.NewPool([]domain.Device{{Serial: "a"}, {Serial: "b"}})
	first, _ := pool.For("s1")
	second, _ := pool.For("s2")
	again, _ := pool.For("s1")
	if first.Serial != "a" || second.Serial != "b" || again.Serial != "a" {
		t.Fatalf("s1 got %s then %s, s2 got %s", first.Serial, again.Serial, second.Serial)
	}
	if _, err := pool.For("s3"); !errors.Is(err, domain.ErrNoneFree) {
		t.Fatalf("a third session took a held device: %v", err)
	}
	pool.Release("s1")
	if third, err := pool.For("s3"); err != nil || third.Serial != "a" {
		t.Fatalf("a released device was not handed on: %v %v", third, err)
	}
	if _, held := pool.Held("s1"); held {
		t.Fatal("a released session still holds a device")
	}
}

func TestInputValidation(t *testing.T) {
	for _, tc := range []struct {
		in domain.Input
		ok bool
	}{
		{domain.Input{Kind: "tap", X: 0.5, Y: 1}, true},
		{domain.Input{Kind: "tap", X: 1.2, Y: 0.5}, false},
		{domain.Input{Kind: "swipe", X: 0.1, Y: 0.9, ToX: 0.1, ToY: 0.2}, true},
		{domain.Input{Kind: "text"}, false},
		{domain.Input{Kind: "key", Key: "enter"}, true},
		{domain.Input{Kind: "key", Key: "f13"}, false},
		{domain.Input{Kind: "button", Button: "power"}, false},
		{domain.Input{Kind: "shell"}, false},
	} {
		if err := tc.in.Validate(); (err == nil) != tc.ok {
			t.Errorf("%+v: valid=%v, want %v", tc.in, err == nil, tc.ok)
		}
	}
}
