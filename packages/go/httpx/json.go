package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// DecodeJSON reads a JSON body into v, rejecting unknown fields and trailing
// data. Failures are 400 problems the caller returns as is.
func DecodeJSON(r *http.Request, v any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		return problem.Status(http.StatusUnsupportedMediaType).WithDetail("expected application/json, got %s", ct)
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var maxErr *http.MaxBytesError
		switch {
		case errors.As(err, &maxErr):
			return problem.ErrPayloadSize.WithDetail("body exceeds %d bytes", maxErr.Limit)
		case errors.Is(err, io.EOF):
			return problem.ErrValidation.WithDetail("request body is empty")
		default:
			return problem.ErrValidation.WithDetail("malformed JSON: %s", err.Error())
		}
	}
	if dec.More() {
		return problem.ErrValidation.WithDetail("request body must contain a single JSON document")
	}
	return nil
}

// WriteJSON encodes v with the given status. Encoding errors after the header
// is written cannot be reported, so v must be a plain data struct.
func WriteJSON(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return nil
	}
	return json.NewEncoder(w).Encode(v)
}

// NoContent sends a 204.
func NoContent(w http.ResponseWriter) error {
	w.WriteHeader(http.StatusNoContent)
	return nil
}
