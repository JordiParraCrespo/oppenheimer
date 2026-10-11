package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"
)

//go:embed profiles.json
var profilesJSON []byte

// Access is one side's last mile.
type Access struct {
	Note      string  `json:"note,omitempty"`
	LatencyMs float64 `json:"latencyMs"`
	JitterMs  float64 `json:"jitterMs"`
	Loss      float64 `json:"loss"`
	DownMbps  float64 `json:"downMbps"`
	UpMbps    float64 `json:"upMbps"`
}

// Profiles is profiles.json: where places are and what links they sit behind.
type Profiles struct {
	Note           string            `json:"note"`
	SameLocationMs float64           `json:"sameLocationMs"`
	Geo            []GeoEntry        `json:"geo"`
	Access         map[string]Access `json:"access"`
}

// GeoEntry is the one-way delay between two locations, either way.
type GeoEntry struct {
	A  string  `json:"a"`
	B  string  `json:"b"`
	Ms float64 `json:"ms"`
}

func loadProfiles() (*Profiles, error) {
	var p Profiles
	if err := json.Unmarshal(profilesJSON, &p); err != nil {
		return nil, fmt.Errorf("profiles.json: %w", err)
	}
	return &p, nil
}

func (p *Profiles) geo(a, b string) (float64, bool) {
	if a == b {
		return p.SameLocationMs, true
	}
	for _, g := range p.Geo {
		if (g.A == a && g.B == b) || (g.A == b && g.B == a) {
			return g.Ms, true
		}
	}
	return 0, false
}

func (p *Profiles) hasLocation(l string) bool {
	for _, g := range p.Geo {
		if g.A == l || g.B == l {
			return true
		}
	}
	return false
}

// Placement is where a node is and what it is connected through. Two nodes
// that name the same LAN reach each other over the `lan` access and nothing
// else, the way a laptop reaches a desktop on the same Wi-Fi.
type Placement struct {
	Location string `json:"location"`
	Access   string `json:"access"`
	LAN      string `json:"lan,omitempty"`
}

func (p *Profiles) validate(pl Placement) error {
	if !p.hasLocation(pl.Location) {
		return fmt.Errorf("unknown location %q", pl.Location)
	}
	if _, ok := p.Access[pl.Access]; !ok {
		return fmt.Errorf("unknown access %q", pl.Access)
	}
	return nil
}

// maxQueue is the deepest a link's buffer gets before it drops, as a delay:
// past it a packet is lost rather than queued, which is what bounds
// bufferbloat on a real modem.
const maxQueue = 400 * time.Millisecond

// Model decides, for one packet, when it arrives or that it is lost. Each
// node has an uplink and a downlink, each a FIFO at its access's rate; between
// them is propagation (both last miles plus geography) and jitter. Delivery on
// one directed leg never reorders: jitter stretches a leg, it does not
// shuffle it, which is how real paths mostly behave and what TCP expects.
type Model struct {
	mu         sync.Mutex
	profiles   *Profiles
	placements []Placement
	upFree     []time.Time
	downFree   []time.Time
	last       map[[2]int]time.Time
	rand       func() float64
	norm       func() float64
}

func newModel(p *Profiles, placements []Placement, rand, norm func() float64) *Model {
	return &Model{
		profiles:   p,
		placements: placements,
		upFree:     make([]time.Time, len(placements)),
		downFree:   make([]time.Time, len(placements)),
		last:       map[[2]int]time.Time{},
		rand:       rand,
		norm:       norm,
	}
}

// Place moves node i; packets already in flight keep their times.
func (m *Model) Place(i int, pl Placement) error {
	if err := m.profiles.validate(pl); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.placements[i] = pl
	return nil
}

// Placement is node i's current placement.
func (m *Model) Placement(i int) Placement {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.placements[i]
}

func serialize(bytes int, mbps float64) time.Duration {
	return time.Duration(float64(bytes*8) / (mbps * 1e6) * float64(time.Second))
}

func ms(v float64) time.Duration { return time.Duration(v * float64(time.Millisecond)) }

func (m *Model) jitter(j float64) float64 { return math.Abs(m.norm()) * j }

// Schedule is when a packet of size bytes sent at now from src reaches dst,
// or false when the path loses it.
func (m *Model) Schedule(now time.Time, src, dst, size int) (time.Time, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, b := m.placements[src], m.placements[dst]
	up, down := m.profiles.Access[a.Access], m.profiles.Access[b.Access]
	var propagation float64
	if a.LAN != "" && a.LAN == b.LAN {
		lan := m.profiles.Access["lan"]
		up, down = lan, lan
		propagation = lan.LatencyMs + m.jitter(lan.JitterMs)
	} else {
		geo, _ := m.profiles.geo(a.Location, b.Location)
		propagation = up.LatencyMs + down.LatencyMs + geo + m.jitter(up.JitterMs) + m.jitter(down.JitterMs)
	}
	if m.rand() < 1-(1-up.Loss)*(1-down.Loss) {
		return time.Time{}, false
	}

	start := later(now, m.upFree[src])
	if start.Sub(now) > maxQueue {
		return time.Time{}, false
	}
	m.upFree[src] = start.Add(serialize(size, up.UpMbps))
	arrive := m.upFree[src].Add(ms(propagation))

	start = later(arrive, m.downFree[dst])
	if start.Sub(arrive) > maxQueue {
		return time.Time{}, false
	}
	m.downFree[dst] = start.Add(serialize(size, down.DownMbps))
	at := later(m.downFree[dst], m.last[[2]int{src, dst}])
	m.last[[2]int{src, dst}] = at
	return at, true
}

func later(a, b time.Time) time.Time {
	if b.After(a) {
		return b
	}
	return a
}
