package domain

import (
	"net/http"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// Catalog entries for this context. Each has a row in apps/docs/docs/errors.md.
var (
	ErrJobNotFound       = problem.New("JOB_001", http.StatusNotFound, "Job not found")
	ErrInvalidTransition = problem.New("JOB_002", http.StatusConflict, "Job is not in a state that allows this")
	ErrQueueFull         = problem.New("JOB_003", http.StatusTooManyRequests, "Job queue is full")
	ErrUnknownKind       = problem.New("JOB_004", http.StatusBadRequest, "No runner registered for this job kind")
)
