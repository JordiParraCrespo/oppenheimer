package problem

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTypeFor(t *testing.T) {
	if got := TypeFor("RUNNER_001", "https://oppenheimer.dev/errors/"); got != "https://oppenheimer.dev/errors#runner_001" {
		t.Fatalf("unexpected type %q", got)
	}
	if got := TypeFor("", "x"); got != DefaultType {
		t.Fatalf("bare status should be about:blank, got %q", got)
	}
}

func TestWriteHidesInternalCause(t *testing.T) {
	w := &Writer{}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs", nil)
	req = req.WithContext(WithCorrelationID(req.Context(), "req-1"))

	w.Write(rec, req, errors.New("database exploded"))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != ContentType {
		t.Fatalf("content type = %q", ct)
	}
	var doc Details
	if err := json.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
		t.Fatal(err)
	}
	if doc.Detail != "" {
		t.Fatalf("internal detail leaked: %q", doc.Detail)
	}
	if doc.Code != "RUNNER_500" || doc.CorrelationID != "req-1" || doc.Instance != "/v1/jobs" {
		t.Fatalf("unexpected document %+v", doc)
	}
}

func TestWriteCatalogError(t *testing.T) {
	w := &Writer{}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs/abc", nil)

	w.Write(rec, req, ErrNotFound.WithDetail("job %q", "abc"))

	var doc Details
	_ = json.Unmarshal(rec.Body.Bytes(), &doc)
	if rec.Code != 404 || doc.Detail != `job "abc"` || doc.Title != "Resource not found" {
		t.Fatalf("unexpected document %+v", doc)
	}
}

func TestErrorsIsAcrossWithDetail(t *testing.T) {
	err := ErrConflict.WithDetail("x")
	if !errors.Is(err, err) {
		t.Fatal("identity")
	}
	var pe *Error
	if !errors.As(err, &pe) || pe.Code != "RUNNER_005" {
		t.Fatal("errors.As should find the problem")
	}
}
