// Package problem produces RFC 7807 problem documents.
//
// It mirrors `packages/backend/core/src/errors/problem-details.ts` field for
// field so a client that already understands the NestJS API's errors needs no
// second parser: `type` is a fragment on the shared catalog page, `title` is
// the stable catalog message, `detail` carries the per-request specifics, and
// `code`, `correlationId`, `timestamp` and `invalidParams` are the same
// extension members.
package problem

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// ContentType is the media type every error response is sent with.
const ContentType = "application/problem+json"

// DefaultType is the RFC 7807 `type` of a problem with no catalog entry.
const DefaultType = "about:blank"

// DefaultTypeBaseURL is where `type` URIs point when nothing is configured.
const DefaultTypeBaseURL = "https://oppenheimer.dev/errors"

// InvalidParam describes one rejected input field (RFC 7807 §3.2 extension,
// same shape the NestJS validation pipe emits).
type InvalidParam struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

// Details is the wire document.
type Details struct {
	Type          string         `json:"type"`
	Title         string         `json:"title"`
	Status        int            `json:"status"`
	Detail        string         `json:"detail,omitempty"`
	Instance      string         `json:"instance,omitempty"`
	Code          string         `json:"code,omitempty"`
	InvalidParams []InvalidParam `json:"invalidParams,omitempty"`
	CorrelationID string         `json:"correlationId,omitempty"`
	Timestamp     string         `json:"timestamp"`
}

// Error is the one error type handlers and use cases return when they know
// how a failure should be reported. Anything else that reaches the HTTP layer
// becomes an opaque 500 whose cause is logged, never sent.
type Error struct {
	// Code is the catalog identifier, e.g. `RUNNER_001`. Empty for bare
	// status errors, which RFC 7807 renders as `about:blank`.
	Code string
	// Status is the HTTP status the problem is sent with.
	Status int
	// Title is the stable, catalog-level message.
	Title string
	// Detail is the per-request specific, safe to show to the caller.
	Detail string
	// InvalidParams lists rejected fields on 400/422 problems.
	InvalidParams []InvalidParam
	// Cause is the wrapped error, kept for logs and errors.Is/As.
	Cause error
}

func (e *Error) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.Title, e.Detail)
	}
	return e.Title
}

// Unwrap exposes the cause to errors.Is and errors.As.
func (e *Error) Unwrap() error { return e.Cause }

// WithDetail returns a copy carrying a per-request detail. The catalog value
// is never mutated, so the same sentinel can be reused across requests.
func (e *Error) WithDetail(format string, args ...any) *Error {
	c := *e
	c.Detail = fmt.Sprintf(format, args...)
	return &c
}

// WithCause returns a copy wrapping the underlying error.
func (e *Error) WithCause(cause error) *Error {
	c := *e
	c.Cause = cause
	return &c
}

// WithInvalidParams returns a copy listing the rejected fields.
func (e *Error) WithInvalidParams(params ...InvalidParam) *Error {
	c := *e
	c.InvalidParams = params
	return &c
}

// New declares a catalog entry. Every code needs a row in
// `apps/docs/docs/errors.md`, the page the `type` URI resolves to.
func New(code string, status int, title string) *Error {
	return &Error{Code: code, Status: status, Title: title}
}

// Status is a bare status problem with no catalog entry (about:blank).
func Status(status int) *Error {
	return &Error{Status: status, Title: http.StatusText(status)}
}

// The generic catalog every service shares. Bounded contexts declare their
// own entries next to their domain (see internal/apikeys/domain/errors.go).
var (
	ErrValidation   = New("RUNNER_001", http.StatusBadRequest, "Validation failed")
	ErrUnauthorized = New("RUNNER_002", http.StatusUnauthorized, "Authentication required")
	ErrForbidden    = New("RUNNER_003", http.StatusForbidden, "Insufficient scope")
	ErrNotFound     = New("RUNNER_004", http.StatusNotFound, "Resource not found")
	ErrConflict     = New("RUNNER_005", http.StatusConflict, "Conflict")
	ErrPayloadSize  = New("RUNNER_006", http.StatusRequestEntityTooLarge, "Payload too large")
	ErrInternal     = New("RUNNER_500", http.StatusInternalServerError, "Internal server error")
)

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// TypeFor builds the `type` URI for a code: a fragment on one reference page
// (`…/errors#runner_001`) so every type actually resolves to its paragraph.
func TypeFor(code, baseURL string) string {
	if code == "" {
		return DefaultType
	}
	if baseURL == "" {
		baseURL = DefaultTypeBaseURL
	}
	slug := nonSlug.ReplaceAllString(strings.ToLower(code), "_")
	return strings.TrimRight(baseURL, "#/") + "#" + slug
}

// Writer renders errors as problem documents. One instance is shared by every
// handler; it carries the deployment's type base URL and the logger.
type Writer struct {
	TypeBaseURL string
	Logger      *slog.Logger
	// Now is overridable for tests.
	Now func() time.Time
}

// correlationKey is how the request-id middleware hands the id to the writer
// without importing httpx (which imports this package).
type correlationKey struct{}

// WithCorrelationID stores the request id the document will report.
func WithCorrelationID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, correlationKey{}, id)
}

// CorrelationID returns the id stored by WithCorrelationID, if any.
func CorrelationID(ctx context.Context) string {
	id, _ := ctx.Value(correlationKey{}).(string)
	return id
}

// From converts any error into the problem that should be sent. A *Error is
// used as is; everything else is an internal error with the cause hidden.
func From(err error) *Error {
	var pe *Error
	if errors.As(err, &pe) {
		return pe
	}
	return ErrInternal.WithCause(err)
}

// Write sends err as a problem document for r. Internal errors are logged at
// error level with their cause and correlation id; expected ones at debug.
func (w *Writer) Write(rw http.ResponseWriter, r *http.Request, err error) {
	pe := From(err)
	now := time.Now
	if w.Now != nil {
		now = w.Now
	}
	doc := Details{
		Type:          TypeFor(pe.Code, w.TypeBaseURL),
		Title:         pe.Title,
		Status:        pe.Status,
		Detail:        pe.Detail,
		Instance:      r.URL.Path,
		Code:          pe.Code,
		InvalidParams: pe.InvalidParams,
		CorrelationID: CorrelationID(r.Context()),
		Timestamp:     now().UTC().Format(time.RFC3339Nano),
	}
	if doc.Title == "" {
		doc.Title = http.StatusText(pe.Status)
	}

	if w.Logger != nil {
		attrs := []any{
			slog.Int("status", pe.Status),
			slog.String("code", pe.Code),
			slog.String("correlationId", doc.CorrelationID),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
		}
		if pe.Status >= 500 {
			w.Logger.ErrorContext(r.Context(), "request failed", append(attrs, slog.Any("error", err))...)
		} else {
			w.Logger.DebugContext(r.Context(), "request rejected", append(attrs, slog.String("error", pe.Error()))...)
		}
	}

	rw.Header().Set("Content-Type", ContentType)
	rw.Header().Set("Cache-Control", "no-store")
	rw.WriteHeader(pe.Status)
	_ = json.NewEncoder(rw).Encode(doc)
}
