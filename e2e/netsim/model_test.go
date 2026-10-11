package main

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

func testModel(t *testing.T, placements ...Placement) *Model {
	t.Helper()
	p, err := loadProfiles()
	if err != nil {
		t.Fatal(err)
	}
	// No loss, no jitter: rand never falls under a loss rate, norm is zero.
	return newModel(p, placements, func() float64 { return 1 }, func() float64 { return 0 })
}

func near(t *testing.T, got time.Duration, want float64) {
	t.Helper()
	if d := got.Seconds()*1000 - want; d < -0.05 || d > 0.05 {
		t.Fatalf("took %.3f ms, want %.3f", got.Seconds()*1000, want)
	}
}

// A packet takes both last miles, the distance between the two places, and
// the time to clock it onto each link.
func TestAPacketCrossesBothLastMilesAndTheDistance(t *testing.T) {
	m := testModel(t,
		Placement{Location: "falkenstein", Access: "datacenter"},
		Placement{Location: "barcelona", Access: "adsl"},
	)
	at, ok := m.Schedule(t0, 1, 0, 125)
	if !ok {
		t.Fatal("lost")
	}
	// adsl 18 + datacenter 0.2 + Barcelona–Falkenstein 15, plus 1000 bits on a
	// 1 Mbit uplink (1 ms) and a 1 Gbit downlink (0.001 ms).
	near(t, at.Sub(t0), 18+0.2+15+1+0.001)
}

// Two machines on one LAN reach each other locally, wherever the LAN is.
func TestNodesOnOneLANSkipTheInternet(t *testing.T) {
	m := testModel(t,
		Placement{Location: "falkenstein", Access: "datacenter"},
		Placement{Location: "tokyo", Access: "hotel-wifi", LAN: "home"},
		Placement{Location: "barcelona", Access: "geo-satellite", LAN: "home"},
	)
	at, _ := m.Schedule(t0, 1, 2, 125)
	near(t, at.Sub(t0), 0.3+0.002+0.002)
}

// A burst queues behind the narrowest link, and a buffer that would hold a
// packet longer than maxQueue drops it instead.
func TestAnUplinkQueuesABurstAndDropsWhenItsBufferIsFull(t *testing.T) {
	m := testModel(t,
		Placement{Location: "barcelona", Access: "datacenter"},
		Placement{Location: "barcelona", Access: "adsl"},
	)
	first, _ := m.Schedule(t0, 1, 0, 1250)  // 10 ms on the 1 Mbit uplink
	second, _ := m.Schedule(t0, 1, 0, 1250) // waits for the first
	near(t, second.Sub(first), 10)
	for range 40 {
		m.Schedule(t0, 1, 0, 1250)
	}
	if _, ok := m.Schedule(t0, 1, 0, 1250); ok {
		t.Fatal("a packet queued 420 ms deep was not dropped")
	}
}

// Jitter stretches a leg but never reorders it.
func TestJitterNeverReordersALeg(t *testing.T) {
	m := testModel(t,
		Placement{Location: "falkenstein", Access: "datacenter"},
		Placement{Location: "barcelona", Access: "4g"},
	)
	jitters := []float64{3, 0, 2, 0}
	m.norm = func() float64 { v := jitters[0]; jitters = append(jitters[1:], v); return v }
	a, _ := m.Schedule(t0, 1, 0, 100)
	b, _ := m.Schedule(t0.Add(time.Millisecond), 1, 0, 100)
	if b.Before(a) {
		t.Fatalf("the second packet arrived %v before the first", a.Sub(b))
	}
}

// Every pair of places has a distance: a missing one would put two cities in
// the same street.
func TestEveryPairOfLocationsHasADistance(t *testing.T) {
	p, err := loadProfiles()
	if err != nil {
		t.Fatal(err)
	}
	locations := map[string]bool{}
	for _, g := range p.Geo {
		locations[g.A], locations[g.B] = true, true
	}
	for a := range locations {
		for b := range locations {
			if _, ok := p.geo(a, b); !ok {
				t.Errorf("no distance between %s and %s", a, b)
			}
		}
	}
	for name, a := range p.Access {
		if a.UpMbps <= 0 || a.DownMbps <= 0 {
			t.Errorf("access %s has no rate", name)
		}
	}
}
