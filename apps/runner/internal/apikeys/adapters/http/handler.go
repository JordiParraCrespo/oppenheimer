// Package http is the REST adapter for API keys.
package http

import (
	"net/http"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/apikeys/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/scopes"
	"github.com/jordiparracrespo/oppenheimer/packages/go/auth"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Handler exposes the API-key use cases.
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
	r.HandleFunc("GET /v1/me", h.me)
	r.Group(func(g *httpx.Router) {
		g.Use(auth.RequireScopes(h.problems, scopes.KeysRead))
		g.HandleFunc("GET /v1/api-keys", h.list)
		g.HandleFunc("GET /v1/api-keys/{id}", h.get)
	})
	r.Group(func(g *httpx.Router) {
		g.Use(auth.RequireScopes(h.problems, scopes.KeysWrite))
		g.HandleFunc("POST /v1/api-keys", h.create)
		g.HandleFunc("DELETE /v1/api-keys/{id}", h.revoke)
		g.HandleFunc("POST /v1/service-tokens", h.issueToken)
	})
}

// KeyResponse is a key's metadata. The secret never appears here.
type KeyResponse struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     []string   `json:"scopes"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	RevokedAt  *time.Time `json:"revokedAt,omitempty"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}

// CreatedKeyResponse adds the one-time token.
type CreatedKeyResponse struct {
	KeyResponse
	Token string `json:"token"`
}

// CreateKeyRequest is the create body.
type CreateKeyRequest struct {
	Name      string     `json:"name"`
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// ServiceTokenRequest asks for a JWT for an agent.
type ServiceTokenRequest struct {
	Subject string   `json:"subject"`
	Name    string   `json:"name,omitempty"`
	Scopes  []string `json:"scopes"`
}

// ServiceTokenResponse carries the minted JWT.
type ServiceTokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// MeResponse describes the caller.
type MeResponse struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Kind   string   `json:"kind"`
	Scopes []string `json:"scopes"`
}

func toResponse(k domain.Key) KeyResponse {
	sc := make([]string, len(k.Scopes))
	for i, s := range k.Scopes {
		sc[i] = string(s)
	}
	return KeyResponse{
		ID: k.ID, Name: k.Name, Prefix: k.Prefix, Scopes: sc, CreatedBy: k.CreatedBy,
		CreatedAt: k.CreatedAt, ExpiresAt: k.ExpiresAt, RevokedAt: k.RevokedAt, LastUsedAt: k.LastUsedAt,
	}
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) error {
	p := auth.FromContext(r.Context())
	return httpx.WriteJSON(w, http.StatusOK, MeResponse{ID: p.ID, Name: p.Name, Kind: string(p.Kind), Scopes: p.Scopes.Strings()})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var body CreateKeyRequest
	if err := httpx.DecodeJSON(r, &body); err != nil {
		return err
	}
	created, err := h.svc.Create(r.Context(), app.CreateInput{Name: body.Name, Scopes: body.Scopes, ExpiresAt: body.ExpiresAt})
	if err != nil {
		return err
	}
	return httpx.WriteJSON(w, http.StatusCreated, CreatedKeyResponse{KeyResponse: toResponse(created.Key), Token: created.Token})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	keys, err := h.svc.List(r.Context())
	if err != nil {
		return err
	}
	out := make([]KeyResponse, len(keys))
	for i, k := range keys {
		out[i] = toResponse(k)
	}
	return httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	key, err := h.svc.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	return httpx.WriteJSON(w, http.StatusOK, toResponse(key))
}

func (h *Handler) revoke(w http.ResponseWriter, r *http.Request) error {
	if err := h.svc.Revoke(r.Context(), r.PathValue("id")); err != nil {
		return err
	}
	return httpx.NoContent(w)
}

func (h *Handler) issueToken(w http.ResponseWriter, r *http.Request) error {
	var body ServiceTokenRequest
	if err := httpx.DecodeJSON(r, &body); err != nil {
		return err
	}
	token, exp, err := h.svc.IssueServiceToken(r.Context(), body.Subject, body.Name, body.Scopes)
	if err != nil {
		return err
	}
	return httpx.WriteJSON(w, http.StatusCreated, ServiceTokenResponse{Token: token, ExpiresAt: exp})
}
