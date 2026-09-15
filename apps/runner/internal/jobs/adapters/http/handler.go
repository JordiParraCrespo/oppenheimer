// Package http is the REST adapter for jobs.
package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	wsadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/adapters/ws"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/jobs/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Handler exposes the job use cases.
type Handler struct {
	svc      *app.Service
	problems *problem.Writer
}

// New builds the handler.
func New(svc *app.Service, problems *problem.Writer) *Handler {
	return &Handler{svc: svc, problems: problems}
}

// Mount registers the routes on an authenticated router.
func (h *Handler) Mount(r *httpx.Router) {
	r.Group(func(g *httpx.Router) {
		g.Use(auth.RequireScopes(h.problems, scopes.JobsRead))
		g.HandleFunc("GET /v1/jobs", h.list)
		g.HandleFunc("GET /v1/jobs/{id}", h.get)
	})
	r.Group(func(g *httpx.Router) {
		g.Use(auth.RequireScopes(h.problems, scopes.JobsWrite))
		g.HandleFunc("POST /v1/jobs", h.submit)
		g.HandleFunc("POST /v1/jobs/{id}/cancel", h.cancel)
	})
}

// SubmitRequest is the create body.
type SubmitRequest struct {
	Kind    string          `json:"kind"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ListResponse wraps a page.
type ListResponse struct {
	Data []wsadapter.Wire `json:"data"`
}

func (h *Handler) submit(w http.ResponseWriter, r *http.Request) error {
	var body SubmitRequest
	if err := httpx.DecodeJSON(r, &body); err != nil {
		return err
	}
	job, err := h.svc.Submit(r.Context(), app.SubmitInput{Kind: body.Kind, Payload: body.Payload})
	if err != nil {
		return err
	}
	w.Header().Set("Location", "/v1/jobs/"+job.ID)
	return httpx.WriteJSON(w, http.StatusAccepted, wsadapter.ToWire(job))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	var filter app.ListFilter
	if raw := r.URL.Query().Get("status"); raw != "" {
		status, err := domain.ParseStatus(raw)
		if err != nil {
			return problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "status", Reason: err.Error()})
		}
		filter.Status = &status
	}
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			return problem.ErrValidation.WithInvalidParams(problem.InvalidParam{Name: "limit", Reason: "positive integer"})
		}
		filter.Limit = n
	}
	jobs, err := h.svc.List(r.Context(), filter)
	if err != nil {
		return err
	}
	out := make([]wsadapter.Wire, len(jobs))
	for i, j := range jobs {
		out[i] = wsadapter.ToWire(j)
	}
	return httpx.WriteJSON(w, http.StatusOK, ListResponse{Data: out})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	job, err := h.svc.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	return httpx.WriteJSON(w, http.StatusOK, wsadapter.ToWire(job))
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) error {
	job, err := h.svc.Cancel(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	return httpx.WriteJSON(w, http.StatusOK, wsadapter.ToWire(job))
}
