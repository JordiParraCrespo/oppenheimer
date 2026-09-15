package httpx

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func newTestRouter() *Router {
	return NewRouter(&problem.Writer{})
}

func TestRouterWritesProblems(t *testing.T) {
	r := newTestRouter()
	r.Use(RequestID())
	r.HandleFunc("GET /boom", func(w http.ResponseWriter, req *http.Request) error {
		return problem.ErrNotFound.WithDetail("nope")
	})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))
	if rec.Code != 404 || rec.Header().Get("Content-Type") != problem.ContentType {
		t.Fatalf("code=%d ct=%q", rec.Code, rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get(RequestIDHeader) == "" {
		t.Fatal("request id not echoed")
	}
}

func TestUnmatchedRoutesAreProblems(t *testing.T) {
	r := newTestRouter()
	r.Use(RequestID())
	r.HandleFunc("GET /only-get", func(w http.ResponseWriter, req *http.Request) error { return NoContent(w) })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/missing", nil))
	if rec.Code != 404 || rec.Header().Get("Content-Type") != problem.ContentType || rec.Header().Get(RequestIDHeader) == "" {
		t.Fatalf("404: code=%d ct=%q id=%q", rec.Code, rec.Header().Get("Content-Type"), rec.Header().Get(RequestIDHeader))
	}
	if !strings.Contains(rec.Body.String(), `"code":"RUNNER_004"`) {
		t.Fatalf("404 body: %s", rec.Body.String())
	}

	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/only-get", nil))
	if rec.Code != 405 || rec.Header().Get("Allow") != "GET, HEAD" || rec.Header().Get("Content-Type") != problem.ContentType {
		t.Fatalf("405: code=%d allow=%q ct=%q", rec.Code, rec.Header().Get("Allow"), rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Body.String(), `"status":405`) || !strings.Contains(rec.Body.String(), `"type":"about:blank"`) {
		t.Fatalf("405 body: %s", rec.Body.String())
	}
}

func TestGroupInheritsAndIsolatesMiddleware(t *testing.T) {
	r := newTestRouter()
	var order []string
	tag := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, req)
			})
		}
	}
	r.Use(tag("root"))
	r.Group(func(g *Router) {
		g.Use(tag("group"))
		g.HandleFunc("GET /in", func(w http.ResponseWriter, req *http.Request) error { return NoContent(w) })
	})
	r.HandleFunc("GET /out", func(w http.ResponseWriter, req *http.Request) error { return NoContent(w) })

	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/in", nil))
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/out", nil))
	if strings.Join(order, ",") != "root,group,root" {
		t.Fatalf("order = %v", order)
	}
}

func TestDecodeJSONRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x","extra":1}`))
	req.Header.Set("Content-Type", "application/json")
	var body struct {
		Name string `json:"name"`
	}
	err := DecodeJSON(req, &body)
	var pe *problem.Error
	if !errors.As(err, &pe) || pe.Status != 400 {
		t.Fatalf("expected 400 problem, got %v", err)
	}
}

func TestRecover(t *testing.T) {
	r := newTestRouter()
	r.Use(Recover(&problem.Writer{}, discardLogger()))
	r.Handle("GET /panic", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { panic("x") }))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/panic", nil))
	if rec.Code != 500 {
		t.Fatalf("code = %d", rec.Code)
	}
}

func TestForwardedFor(t *testing.T) {
	// Two trusted proxies: the nearest appended 10.0.0.2 (the outer proxy's
	// address), the outer one appended 10.0.0.1 (the client). 1.1.1.1 was
	// supplied by the client itself and must not be trusted.
	if got := forwardedFor("1.1.1.1, 10.0.0.1, 10.0.0.2", 2); got != "10.0.0.1" {
		t.Fatalf("got %q", got)
	}
	if got := forwardedFor("1.1.1.1, 10.0.0.1, 10.0.0.2", 3); got != "1.1.1.1" {
		t.Fatalf("got %q", got)
	}
	if got := forwardedFor("1.1.1.1", 3); got != "1.1.1.1" {
		t.Fatalf("short chain should clamp, got %q", got)
	}
}
