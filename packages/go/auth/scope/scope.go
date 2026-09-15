// Package scope is the credential-scope vocabulary shared by every Go
// service: a scope is `<resource>:<level>`, `write` implies `read`, and a
// Catalog says which scopes a given service knows. It mirrors
// packages/shared/src/scopes on the NestJS side so one mental model covers
// both stacks. Services declare their own catalog; this package only knows
// the grammar.
package scope

import (
	"fmt"
	"sort"
	"strings"
)

// Level is read or write.
type Level string

const (
	Read  Level = "read"
	Write Level = "write"
)

// Scope is a `resource:level` string.
type Scope string

// Resource is the part before the colon.
func (s Scope) Resource() string {
	res, _, _ := strings.Cut(string(s), ":")
	return res
}

// Level is the part after the colon.
func (s Scope) Level() Level {
	_, lvl, _ := strings.Cut(string(s), ":")
	return Level(lvl)
}

// Valid reports whether the string has the `resource:read|write` shape.
func (s Scope) Valid() bool {
	res, lvl, ok := strings.Cut(string(s), ":")
	return ok && res != "" && (Level(lvl) == Read || Level(lvl) == Write)
}

// Catalog is the set of scopes a service recognises.
type Catalog struct {
	known map[Scope]struct{}
}

// NewCatalog builds a catalog. It panics on a malformed scope so a typo in
// a service's constant list fails at init, not at the first request.
func NewCatalog(scopes ...Scope) *Catalog {
	c := &Catalog{known: make(map[Scope]struct{}, len(scopes))}
	for _, s := range scopes {
		if !s.Valid() {
			panic(fmt.Sprintf("scope: malformed catalog entry %q", s))
		}
		c.known[s] = struct{}{}
	}
	return c
}

// All lists every scope, sorted.
func (c *Catalog) All() []Scope {
	out := make([]Scope, 0, len(c.known))
	for s := range c.known {
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// Parse validates one string against the catalog.
func (c *Catalog) Parse(s string) (Scope, error) {
	sc := Scope(strings.TrimSpace(s))
	if _, ok := c.known[sc]; !ok {
		return "", fmt.Errorf("unknown scope %q", s)
	}
	return sc, nil
}

// ParseAll validates a list, deduplicating it.
func (c *Catalog) ParseAll(in []string) ([]Scope, error) {
	seen := map[Scope]struct{}{}
	out := make([]Scope, 0, len(in))
	for _, s := range in {
		sc, err := c.Parse(s)
		if err != nil {
			return nil, err
		}
		if _, dup := seen[sc]; dup {
			continue
		}
		seen[sc] = struct{}{}
		out = append(out, sc)
	}
	return out, nil
}

// Set is a granted scope set with the implication rule baked in.
type Set map[Scope]struct{}

// NewSet builds a set from granted scopes.
func NewSet(granted ...Scope) Set {
	s := Set{}
	for _, g := range granted {
		s[g] = struct{}{}
	}
	return s
}

// ParseSet splits a space-separated claim (RFC 8693 style) into a set
// without validating against a catalog: an unknown scope simply never
// satisfies anything.
func ParseSet(claim string) Set {
	s := Set{}
	for _, f := range strings.Fields(claim) {
		s[Scope(f)] = struct{}{}
	}
	return s
}

// Has reports whether the set satisfies the required scope. `write` on a
// resource satisfies `read` on the same resource.
func (s Set) Has(required Scope) bool {
	if _, ok := s[required]; ok {
		return true
	}
	if required.Level() == Read {
		_, ok := s[Scope(required.Resource()+":"+string(Write))]
		return ok
	}
	return false
}

// HasAll reports whether every required scope is satisfied.
func (s Set) HasAll(required ...Scope) bool {
	for _, r := range required {
		if !s.Has(r) {
			return false
		}
	}
	return true
}

// Missing lists the required scopes the set does not satisfy.
func (s Set) Missing(required ...Scope) []Scope {
	var out []Scope
	for _, r := range required {
		if !s.Has(r) {
			out = append(out, r)
		}
	}
	return out
}

// Strings renders the set sorted, for JSON and JWT claims.
func (s Set) Strings() []string {
	out := make([]string, 0, len(s))
	for sc := range s {
		out = append(out, string(sc))
	}
	sort.Strings(out)
	return out
}

// Join renders scopes for a problem detail.
func Join(s []Scope) string {
	parts := make([]string, len(s))
	for i, sc := range s {
		parts[i] = string(sc)
	}
	return strings.Join(parts, ", ")
}
