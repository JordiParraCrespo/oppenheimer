package ws

import (
	"encoding/json"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
)

// Wire is the job shape on the socket and on REST. One struct keeps both
// surfaces identical, which is what a typed client wants.
type Wire struct {
	ID         string          `json:"id"`
	Kind       string          `json:"kind"`
	Payload    json.RawMessage `json:"payload"`
	Status     domain.Status   `json:"status"`
	Error      string          `json:"error,omitempty"`
	CreatedBy  string          `json:"createdBy"`
	CreatedAt  time.Time       `json:"createdAt"`
	StartedAt  *time.Time      `json:"startedAt,omitempty"`
	FinishedAt *time.Time      `json:"finishedAt,omitempty"`
}

// ToWire maps the aggregate.
func ToWire(j domain.Job) Wire {
	return Wire{
		ID: j.ID, Kind: j.Kind, Payload: j.Payload, Status: j.Status, Error: j.Error,
		CreatedBy: j.CreatedBy, CreatedAt: j.CreatedAt, StartedAt: j.StartedAt, FinishedAt: j.FinishedAt,
	}
}
