// Package health exposes liveness, readiness and capability endpoints.
// They are unauthenticated: orchestrators probe them before any credential
// exists, and nothing they return is sensitive.
package health

import (
	"context"
	"net/http"
	"sort"
	"sync"

	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Checker reports whether a dependency is ready. Bounded contexts and
// adapters register one for anything readiness depends on.
type Checker interface {
	Name() string
	Check(ctx context.Context) error
}

// CheckerFunc adapts a function to Checker.
type CheckerFunc struct {
	CheckName string
	Fn        func(ctx context.Context) error
}

func (c CheckerFunc) Name() string                    { return c.CheckName }
func (c CheckerFunc) Check(ctx context.Context) error { return c.Fn(ctx) }

// Module owns the health routes.
type Module struct {
	version      string
	capabilities map[string]bool

	mu       sync.RWMutex
	checkers []Checker
}

// New builds the module. capabilities is the resolved feature set, computed
// once at boot from config (mirrors the API's resolveCapabilities).
func New(version string, capabilities map[string]bool) *Module {
	return &Module{version: version, capabilities: capabilities}
}

// Register adds a readiness dependency.
func (m *Module) Register(c Checker) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.checkers = append(m.checkers, c)
}

// Mount registers the routes on a router that carries no auth.
func (m *Module) Mount(r *httpx.Router) {
	r.HandleFunc("GET /healthz", m.live)
	r.HandleFunc("GET /readyz", m.ready)
	r.HandleFunc("GET /health/capabilities", m.caps)
}

type statusBody struct {
	Status  string            `json:"status"`
	Version string            `json:"version"`
	Checks  map[string]string `json:"checks,omitempty"`
}

func (m *Module) live(w http.ResponseWriter, r *http.Request) error {
	return httpx.WriteJSON(w, http.StatusOK, statusBody{Status: "ok", Version: m.version})
}

func (m *Module) ready(w http.ResponseWriter, r *http.Request) error {
	m.mu.RLock()
	checkers := append([]Checker(nil), m.checkers...)
	m.mu.RUnlock()

	body := statusBody{Status: "ok", Version: m.version, Checks: map[string]string{}}
	status := http.StatusOK
	for _, c := range checkers {
		if err := c.Check(r.Context()); err != nil {
			body.Checks[c.Name()] = "down"
			body.Status = "degraded"
			status = http.StatusServiceUnavailable
			continue
		}
		body.Checks[c.Name()] = "up"
	}
	return httpx.WriteJSON(w, status, body)
}

type capabilitiesBody struct {
	Capabilities []string `json:"capabilities"`
}

func (m *Module) caps(w http.ResponseWriter, r *http.Request) error {
	var enabled []string
	for name, on := range m.capabilities {
		if on {
			enabled = append(enabled, name)
		}
	}
	sort.Strings(enabled)
	if enabled == nil {
		enabled = []string{}
	}
	return httpx.WriteJSON(w, http.StatusOK, capabilitiesBody{Capabilities: enabled})
}
