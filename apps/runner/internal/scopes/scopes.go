// Package scopes is this service's credential scope catalog, built on the
// shared grammar in packages/go/auth/scope. Adding a resource here is the
// only step needed for it to be grantable on a key and checkable on a route.
package scopes

import "github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"

// Catalog entries.
const (
	KeysRead   scope.Scope = "keys:read"
	KeysWrite  scope.Scope = "keys:write"
	EventsRead scope.Scope = "events:read"
)

// Catalog is what keys and tokens are validated against.
var Catalog = scope.NewCatalog(KeysRead, KeysWrite, EventsRead)

// All lists every scope, for the bootstrap principal and listings.
func All() []scope.Scope { return Catalog.All() }

// ParseAll validates a list against the catalog.
func ParseAll(in []string) ([]scope.Scope, error) { return Catalog.ParseAll(in) }
