package system

import (
	"context"
	"time"
)

// NewForTest builds a prober whose version call and clock are the test's.
func NewForTest(version func(ctx context.Context, path string) string, now func() time.Time) *Prober {
	return &Prober{version: version, now: now, tools: map[string]toolEntry{}}
}

// FactsTTL exposes the cache's backstop.
const FactsTTL = factsTTL
