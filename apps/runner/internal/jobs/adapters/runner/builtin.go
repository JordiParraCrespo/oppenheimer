// Package runner ships the built-in job kinds. They exist so the pipeline
// can be exercised end to end before any real orchestration exists; a real
// service replaces them with runners that talk to Docker, a hypervisor or a
// CI provider.
package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
)

// Builtin returns the default registry.
func Builtin() map[string]app.Runner {
	return map[string]app.Runner{
		"sleep": app.RunnerFunc(Sleep),
		"fail":  app.RunnerFunc(Fail),
	}
}

// Sleep waits `durationMs` (default 1000), honouring cancellation.
func Sleep(ctx context.Context, job domain.Job) error {
	var payload struct {
		DurationMs int `json:"durationMs"`
	}
	if err := json.Unmarshal(job.Payload, &payload); err != nil && string(job.Payload) != "null" {
		return fmt.Errorf("payload: %w", err)
	}
	if payload.DurationMs <= 0 {
		payload.DurationMs = 1000
	}
	select {
	case <-time.After(time.Duration(payload.DurationMs) * time.Millisecond):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Fail always fails with the payload's `reason`, to exercise the failure path.
func Fail(_ context.Context, job domain.Job) error {
	var payload struct {
		Reason string `json:"reason"`
	}
	_ = json.Unmarshal(job.Payload, &payload)
	if payload.Reason == "" {
		payload.Reason = "requested failure"
	}
	return fmt.Errorf("%s", payload.Reason)
}
