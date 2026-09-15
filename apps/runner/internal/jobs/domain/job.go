// Package domain is the job aggregate: the unit of work this service
// executes on behalf of the API. It is the example bounded context — rename
// it to whatever the service actually orchestrates (runners, VMs,
// containers) and keep the shape.
package domain

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Status is the lifecycle state.
type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusSucceeded Status = "succeeded"
	StatusFailed    Status = "failed"
	StatusCancelled Status = "cancelled"
)

// Terminal reports whether no further transition is possible.
func (s Status) Terminal() bool {
	switch s {
	case StatusSucceeded, StatusFailed, StatusCancelled:
		return true
	}
	return false
}

// ParseStatus validates a filter value.
func ParseStatus(raw string) (Status, error) {
	s := Status(strings.ToLower(strings.TrimSpace(raw)))
	switch s {
	case StatusQueued, StatusRunning, StatusSucceeded, StatusFailed, StatusCancelled:
		return s, nil
	}
	return "", fmt.Errorf("unknown status %q", raw)
}

// Job is the aggregate root.
type Job struct {
	ID string
	// Kind selects the Runner that executes it.
	Kind string
	// Payload is opaque to the domain; the runner for Kind decodes it.
	Payload    json.RawMessage
	Status     Status
	Error      string
	CreatedBy  string
	CreatedAt  time.Time
	StartedAt  *time.Time
	FinishedAt *time.Time
}

// New validates and builds a queued job.
func New(id, kind string, payload json.RawMessage, createdBy string, now time.Time) (Job, error) {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		return Job{}, ErrKindRequired
	}
	if len(payload) == 0 {
		payload = json.RawMessage("null")
	}
	return Job{ID: id, Kind: kind, Payload: payload, Status: StatusQueued, CreatedBy: createdBy, CreatedAt: now}, nil
}

// Start moves a queued job to running.
func (j *Job) Start(now time.Time) error {
	if j.Status != StatusQueued {
		return transitionError(j.Status, StatusRunning)
	}
	j.Status = StatusRunning
	j.StartedAt = &now
	return nil
}

// Succeed finishes a running job.
func (j *Job) Succeed(now time.Time) error {
	if j.Status != StatusRunning {
		return transitionError(j.Status, StatusSucceeded)
	}
	j.Status = StatusSucceeded
	j.FinishedAt = &now
	return nil
}

// Fail finishes a running job with a reason.
func (j *Job) Fail(reason string, now time.Time) error {
	if j.Status != StatusRunning {
		return transitionError(j.Status, StatusFailed)
	}
	j.Status = StatusFailed
	j.Error = reason
	j.FinishedAt = &now
	return nil
}

// Cancel stops a queued or running job.
func (j *Job) Cancel(now time.Time) error {
	if j.Status.Terminal() {
		return transitionError(j.Status, StatusCancelled)
	}
	j.Status = StatusCancelled
	j.FinishedAt = &now
	return nil
}

// ErrKindRequired is a validation failure the use case maps to a problem.
var ErrKindRequired = errors.New("kind is required")

// TransitionError explains a rejected state change.
type TransitionError struct {
	From, To Status
}

func (e *TransitionError) Error() string {
	return fmt.Sprintf("cannot move job from %s to %s", e.From, e.To)
}

func transitionError(from, to Status) error {
	return &TransitionError{From: from, To: to}
}

// Event names published on the jobs stream.
const (
	EventQueued    = "job.queued"
	EventStarted   = "job.started"
	EventFinished  = "job.finished"
	EventCancelled = "job.cancelled"
)

// Event is what observers receive.
type Event struct {
	Name string
	Job  Job
}
