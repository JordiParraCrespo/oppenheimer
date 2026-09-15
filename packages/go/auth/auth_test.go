package auth

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

var secret = []byte("0123456789abcdef0123456789abcdef")

func TestJWTRoundTrip(t *testing.T) {
	j, err := NewJWT(JWTOptions{Secret: secret, Issuer: "runner", Audience: "runner"})
	if err != nil {
		t.Fatal(err)
	}
	tok, err := j.Issue("agent-1", "agent one", scope.NewSet(scope.Scope("jobs:write")), time.Minute, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !j.Accepts(tok) {
		t.Fatal("should accept compact JWS")
	}
	p, err := j.Verify(context.Background(), tok)
	if err != nil {
		t.Fatal(err)
	}
	if p.ID != "agent-1" || p.Kind != KindService || !p.Can(scope.Scope("jobs:read")) || p.Can(scope.Scope("keys:read")) {
		t.Fatalf("unexpected principal %+v", p)
	}
}

func TestJWTRejectsExpiredAndWrongSecret(t *testing.T) {
	j, _ := NewJWT(JWTOptions{Secret: secret})
	tok, _ := j.Issue("x", "", scope.NewSet(), time.Minute, time.Now().Add(-time.Hour))
	if _, err := j.Verify(context.Background(), tok); err == nil {
		t.Fatal("expired token accepted")
	}
	other, _ := NewJWT(JWTOptions{Secret: []byte("ffffffffffffffffffffffffffffffff")})
	tok, _ = j.Issue("x", "", scope.NewSet(), time.Minute, time.Now())
	if _, err := other.Verify(context.Background(), tok); err == nil {
		t.Fatal("foreign signature accepted")
	}
	if _, err := NewJWT(JWTOptions{Secret: []byte("short")}); err == nil {
		t.Fatal("short secret accepted")
	}
}

func TestMiddleware(t *testing.T) {
	j, _ := NewJWT(JWTOptions{Secret: secret})
	problems := &problem.Writer{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	r := httpx.NewRouter(problems)
	r.Use(Authenticate(problems, logger, j))
	r.Group(func(g *httpx.Router) {
		g.Use(RequireScopes(problems, scope.Scope("keys:write")))
		g.HandleFunc("GET /keys", func(w http.ResponseWriter, req *http.Request) error { return httpx.NoContent(w) })
	})
	r.HandleFunc("GET /me", func(w http.ResponseWriter, req *http.Request) error {
		return httpx.WriteJSON(w, 200, FromContext(req.Context()).ID)
	})

	do := func(path, token string) int {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := do("/me", ""); code != 401 {
		t.Fatalf("no credential: %d", code)
	}
	if code := do("/me", "flr_unknown"); code != 401 {
		t.Fatalf("unsupported format: %d", code)
	}
	reader, _ := j.Issue("r", "", scope.NewSet(scope.Scope("keys:read")), time.Minute, time.Now())
	if code := do("/me", reader); code != 200 {
		t.Fatalf("valid token: %d", code)
	}
	if code := do("/keys", reader); code != 403 {
		t.Fatalf("missing scope: %d", code)
	}
	writer, _ := j.Issue("w", "", scope.NewSet(scope.Scope("keys:write")), time.Minute, time.Now())
	if code := do("/keys", writer); code != 204 {
		t.Fatalf("sufficient scope: %d", code)
	}
}
