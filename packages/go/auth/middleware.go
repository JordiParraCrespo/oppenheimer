package auth

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/httpx"
)

// Authenticate requires a `Authorization: Bearer <credential>` header and
// resolves it through the first verifier that accepts the token's format.
// Requests with no or invalid credentials get a 401 problem.
func Authenticate(problems *problem.Writer, logger *slog.Logger, verifiers ...Verifier) httpx.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearer(r)
			if !ok {
				w.Header().Set("WWW-Authenticate", `Bearer realm="runner"`)
				problems.Write(w, r, problem.ErrUnauthorized.WithDetail("missing bearer credential"))
				return
			}
			for _, v := range verifiers {
				if !v.Accepts(token) {
					continue
				}
				p, err := v.Verify(r.Context(), token)
				if err != nil {
					logger.DebugContext(r.Context(), "credential rejected",
						slog.Any("error", err),
						slog.String("correlationId", problem.CorrelationID(r.Context())),
					)
					w.Header().Set("WWW-Authenticate", `Bearer realm="runner", error="invalid_token"`)
					problems.Write(w, r, problem.ErrUnauthorized.WithDetail("invalid credential"))
					return
				}
				next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), p)))
				return
			}
			w.Header().Set("WWW-Authenticate", `Bearer realm="runner", error="invalid_token"`)
			problems.Write(w, r, problem.ErrUnauthorized.WithDetail("unsupported credential format"))
		})
	}
}

// RequireScopes rejects authenticated callers that lack any of the scopes.
// It must run after Authenticate; a missing principal is a programming
// error reported as 401 rather than a silent pass.
func RequireScopes(problems *problem.Writer, required ...scope.Scope) httpx.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := FromContext(r.Context())
			if p == nil {
				problems.Write(w, r, problem.ErrUnauthorized)
				return
			}
			if missing := p.Scopes.Missing(required...); len(missing) > 0 {
				problems.Write(w, r, problem.ErrForbidden.WithDetail("missing scope %s", scope.Join(missing)))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearer(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	scheme, token, found := strings.Cut(h, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
