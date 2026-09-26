package domain

import "context"

type sessionKey struct{}

// WithSession marks ctx as work done for one session. The git a create or a
// close runs reads it, so the credential helper git calls can name the
// session whose token it wants — the same id a session's own shell carries.
func WithSession(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, sessionKey{}, id)
}

// SessionOf is the session ctx does work for, or "" for none.
func SessionOf(ctx context.Context) string {
	id, _ := ctx.Value(sessionKey{}).(string)
	return id
}
