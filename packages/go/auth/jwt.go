package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/jordiparracrespo/oppenheimer/packages/go/auth/scope"
)

// JWTOptions configure the service-token verifier and issuer.
type JWTOptions struct {
	// Secret signs and verifies HS256 tokens. Shared with whoever mints
	// tokens for this service (normally only this service itself).
	Secret []byte
	// Issuer is required on every token when set.
	Issuer string
	// Audience is required on every token when set.
	Audience string
	// Leeway tolerates clock skew on exp/nbf.
	Leeway time.Duration
}

// Claims is the token body. `scope` is space separated as in RFC 8693.
type Claims struct {
	jwt.RegisteredClaims
	Name  string `json:"name,omitempty"`
	Scope string `json:"scope"`
}

// JWT verifies and issues service tokens.
type JWT struct {
	opts   JWTOptions
	parser *jwt.Parser
}

// NewJWT builds the verifier. It refuses an empty secret at construction so
// a misconfigured deployment fails at boot rather than accepting everything.
func NewJWT(opts JWTOptions) (*JWT, error) {
	if len(opts.Secret) < 32 {
		return nil, fmt.Errorf("jwt secret must be at least 32 bytes")
	}
	parserOpts := []jwt.ParserOption{
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(opts.Leeway),
	}
	if opts.Issuer != "" {
		parserOpts = append(parserOpts, jwt.WithIssuer(opts.Issuer))
	}
	if opts.Audience != "" {
		parserOpts = append(parserOpts, jwt.WithAudience(opts.Audience))
	}
	return &JWT{opts: opts, parser: jwt.NewParser(parserOpts...)}, nil
}

// Accepts matches the three-segment compact JWS shape.
func (j *JWT) Accepts(token string) bool {
	return strings.Count(token, ".") == 2
}

// Verify parses and validates the token.
func (j *JWT) Verify(_ context.Context, token string) (*Principal, error) {
	var claims Claims
	_, err := j.parser.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		return j.opts.Secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidCredential, err)
	}
	if claims.Subject == "" {
		return nil, fmt.Errorf("%w: missing sub", ErrInvalidCredential)
	}
	return &Principal{
		ID:     claims.Subject,
		Name:   claims.Name,
		Kind:   KindService,
		Scopes: scope.ParseSet(claims.Scope),
	}, nil
}

// Issue mints a token for subject with the scopes, valid for ttl. Callers
// (the api-keys use case, an agent-bootstrap flow) decide who deserves one.
func (j *JWT) Issue(subject, name string, granted scope.Set, ttl time.Duration, now time.Time) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
		Name:  name,
		Scope: strings.Join(granted.Strings(), " "),
	}
	if j.opts.Issuer != "" {
		claims.Issuer = j.opts.Issuer
	}
	if j.opts.Audience != "" {
		claims.Audience = jwt.ClaimStrings{j.opts.Audience}
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(j.opts.Secret)
}
