package auth

import "errors"

// ErrInvalidCredential is returned by verifiers for anything that does not
// authenticate. The reason (unknown, expired, revoked, bad signature) is
// logged, never sent: a caller must not learn which part of a guess was
// right.
var ErrInvalidCredential = errors.New("invalid credential")
