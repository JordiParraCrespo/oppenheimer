package cli

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// askTimeout bounds how long git waits on the control plane for a token: a
// helper that hangs is worse than one that says it has none.
const askTimeout = 10 * time.Second

// tokenRefreshMargin is how long before expiry a cached token is treated as
// gone, so a push started just before the hour never uses a token that
// expires during it.
const tokenRefreshMargin = 5 * time.Minute

// credentialBroker answers the credential helper: one installation token per
// session, asked of the control plane on the link when git first needs it and
// held in memory until it expires or is revoked (02-runner §8; F21). Nothing
// is written to disk and nothing is logged.
type credentialBroker struct {
	client   sender
	unseal   func(sealed []byte) ([]byte, error)
	sessions func(id string) (sessionsdomain.Session, error)
	now      func() time.Time

	mu      sync.Mutex
	tokens  map[string]cachedToken     // session id → token
	waiting map[string]chan grantReply // request id → the ask waiting on it
	asking  map[string]*inflight       // session id → the ask every concurrent caller joins
}

// sender is the link, as far as the broker needs it.
type sender interface {
	Send(message any) error
}

// inflight is one ask on the link that every caller for the same session
// waits on: git calls the helper concurrently for remotes, submodules and
// LFS, and each would otherwise have the control plane mint its own
// installation token.
type inflight struct {
	done  chan struct{}
	token string
	err   error
}

type cachedToken struct {
	token     string
	expiresAt time.Time
}

type grantReply struct {
	sealed    []byte
	expiresAt time.Time
	err       error
}

var errNoCredential = errors.New("no credential for this session")

func newCredentialBroker(client sender, unseal func([]byte) ([]byte, error), sessions func(string) (sessionsdomain.Session, error)) *credentialBroker {
	return &credentialBroker{
		client: client, unseal: unseal, sessions: sessions, now: time.Now,
		tokens: map[string]cachedToken{}, waiting: map[string]chan grantReply{},
		asking: map[string]*inflight{},
	}
}

// Get answers the helper for one session: the cached token while it is fresh,
// otherwise one asked for on the link and unsealed here. A session whose
// create is still running is one the session service already answers for,
// so its clone gets a token like any git inside a session does.
//
// Concurrent callers for one session share a single ask. It runs on a
// context of its own, bounded by askTimeout, so the caller that started it
// going away does not fail the others; each caller stops waiting when its
// own context ends.
func (b *credentialBroker) Get(ctx context.Context, sessionID string) (string, error) {
	if sessionID == "" {
		return "", errNoCredential
	}
	if strings.HasPrefix(sessionID, preparePrefix) {
		b.mu.Lock()
		held, ok := b.tokens[sessionID]
		b.mu.Unlock()
		if !ok || !b.now().Before(held.expiresAt) {
			return "", errNoCredential
		}
		return held.token, nil
	}
	b.mu.Lock()
	cached, ok := b.tokens[sessionID]
	if ok && b.now().Add(tokenRefreshMargin).Before(cached.expiresAt) {
		b.mu.Unlock()
		return cached.token, nil
	}
	call, joined := b.asking[sessionID]
	if !joined {
		call = &inflight{done: make(chan struct{})}
		b.asking[sessionID] = call
	}
	b.mu.Unlock()

	if !joined {
		go func() {
			call.token, call.err = b.ask(context.WithoutCancel(ctx), sessionID)
			b.mu.Lock()
			delete(b.asking, sessionID)
			b.mu.Unlock()
			close(call.done)
		}()
	}
	select {
	case <-ctx.Done():
		return "", errNoCredential
	case <-call.done:
		return call.token, call.err
	}
}

// ask sends one `credentials.token` and waits for its grant, caching the
// token it unseals.
func (b *credentialBroker) ask(ctx context.Context, sessionID string) (string, error) {
	session, err := b.sessions(sessionID)
	if err != nil || session.CheckoutID == "" {
		return "", errNoCredential
	}

	requestID, err := newRequestID()
	if err != nil {
		return "", err
	}
	reply := make(chan grantReply, 1)
	b.mu.Lock()
	b.waiting[requestID] = reply
	b.mu.Unlock()
	defer func() {
		b.mu.Lock()
		delete(b.waiting, requestID)
		b.mu.Unlock()
	}()

	err = b.client.Send(link.CredentialsToken{
		Type: "credentials.token", RequestID: requestID, SessionID: sessionID,
		CheckoutID: session.CheckoutID, GithubRepoID: session.GithubRepoID,
	})
	if err != nil {
		return "", errNoCredential
	}
	ctx, cancel := context.WithTimeout(ctx, askTimeout)
	defer cancel()
	select {
	case <-ctx.Done():
		return "", errNoCredential
	case granted := <-reply:
		if granted.err != nil {
			return "", granted.err
		}
		plain, err := b.unseal(granted.sealed)
		if err != nil {
			return "", err
		}
		b.mu.Lock()
		b.tokens[sessionID] = cachedToken{token: string(plain), expiresAt: granted.expiresAt}
		b.mu.Unlock()
		return string(plain), nil
	}
}

// Grant is `credentials.grant` from the link, matched to the ask by request id.
func (b *credentialBroker) Grant(m link.CredentialsGrant) {
	sealed, err := base64.StdEncoding.DecodeString(m.Sealed)
	b.deliver(m.RequestID, grantReply{sealed: sealed, expiresAt: m.ExpiresAt, err: err})
}

// Refuse is a `command.failed` whose command id was a credential ask.
func (b *credentialBroker) Refuse(requestID string, err error) bool {
	return b.deliver(requestID, grantReply{err: err})
}

// preparePrefix marks a credential identity that is a `repository.prepare`
// command rather than a session. Its token arrives with the command; there is
// nothing to ask the control plane for.
const preparePrefix = "prepare:"

// Hold keeps a token handed over with a command, for the git that command runs.
func (b *credentialBroker) Hold(id, token string, expiresAt time.Time) {
	b.mu.Lock()
	b.tokens[id] = cachedToken{token: token, expiresAt: expiresAt}
	b.mu.Unlock()
}

// Revoke drops a session's token early, as `credentials.revoke` asks.
func (b *credentialBroker) Revoke(sessionID string) {
	b.mu.Lock()
	delete(b.tokens, sessionID)
	b.mu.Unlock()
}

// Forget drops a session's token as it closes.
func (b *credentialBroker) Forget(sessionID string) { b.Revoke(sessionID) }

func (b *credentialBroker) deliver(requestID string, reply grantReply) bool {
	b.mu.Lock()
	waiting, ok := b.waiting[requestID]
	b.mu.Unlock()
	if !ok {
		return false
	}
	select {
	case waiting <- reply:
	default:
	}
	return true
}

func newRequestID() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	// A UUID-shaped id, which is what the protocol's commandId schema takes.
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	h := hex.EncodeToString(raw)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:], nil
}
