package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// RequestIDHeader is read from the caller when present (so the NestJS API
// can propagate its own correlation id) and always echoed back.
const RequestIDHeader = "X-Request-Id"

// RequestID assigns each request a correlation id, available through
// problem.CorrelationID and echoed on the response.
func RequestID() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get(RequestIDHeader)
			if id == "" || len(id) > 128 {
				id = newRequestID()
			}
			w.Header().Set(RequestIDHeader, id)
			next.ServeHTTP(w, r.WithContext(problem.WithCorrelationID(r.Context(), id)))
		})
	}
}

func newRequestID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Recover turns panics into 500 problems instead of dropping the connection.
func Recover(problems *problem.Writer, logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					if err, ok := rec.(error); ok && errors.Is(err, http.ErrAbortHandler) {
						panic(rec)
					}
					logger.ErrorContext(r.Context(), "panic recovered",
						slog.Any("panic", rec),
						slog.String("stack", string(debug.Stack())),
						slog.String("correlationId", problem.CorrelationID(r.Context())),
					)
					problems.Write(w, r, problem.ErrInternal)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// statusRecorder captures the status for the access log without buffering
// the body. It forwards Flush and Hijack so streaming and WebSocket upgrades
// still work through it.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusRecorder) WriteHeader(code int) {
	if s.status == 0 {
		s.status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap lets http.ResponseController reach the underlying writer, which is
// what the WebSocket library uses to hijack the connection.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

// Logger writes one structured access-log line per request.
func Logger(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)
			status := rec.status
			if status == 0 {
				// A hijacked (WebSocket) connection never writes a status here.
				status = http.StatusSwitchingProtocols
			}
			level := slog.LevelInfo
			if status >= 500 {
				level = slog.LevelError
			}
			logger.LogAttrs(r.Context(), level, "request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", status),
				slog.Int("bytes", rec.bytes),
				slog.Duration("duration", time.Since(start)),
				slog.String("ip", ClientIP(r)),
				slog.String("correlationId", problem.CorrelationID(r.Context())),
			)
		})
	}
}

// MaxBytes caps request bodies. Oversized reads surface through DecodeJSON as
// a 413 problem.
func MaxBytes(limit int64) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RealIP rewrites r.RemoteAddr from X-Forwarded-For when the service sits
// behind `hops` trusted reverse proxies, mirroring the API's TRUST_PROXY.
// With zero hops the header is ignored, so a direct client cannot spoof it.
func RealIP(hops int) Middleware {
	return func(next http.Handler) http.Handler {
		if hops <= 0 {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ip := forwardedFor(r.Header.Get("X-Forwarded-For"), hops); ip != "" {
				r.RemoteAddr = ip
			}
			next.ServeHTTP(w, r)
		})
	}
}

// forwardedFor picks the address `hops` from the right of the chain: each
// trusted proxy appends the address it saw, so the client is that far back.
func forwardedFor(header string, hops int) string {
	if header == "" {
		return ""
	}
	parts := strings.Split(header, ",")
	idx := len(parts) - hops
	if idx < 0 {
		idx = 0
	}
	return strings.TrimSpace(parts[idx])
}

// ClientIP is the address to rate limit, audit and allowlist on.
func ClientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// SecurityHeaders sets the small set of headers that make sense on a JSON
// API that no browser renders.
func SecurityHeaders() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "no-referrer")
			next.ServeHTTP(w, r)
		})
	}
}
