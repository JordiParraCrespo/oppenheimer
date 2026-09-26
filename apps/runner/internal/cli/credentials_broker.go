package cli

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
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
// session, pulled from the control plane on the link before it is needed and
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
	// creating holds the checkout of each session whose create is still
	// running. The clone is the create's first step and needs a token for a
	// private repository, but the session is recorded only once the create
	// lands — so until then, this is how the broker knows what it is for.
	creating map[string]creatingCheckout
}

// sender is the link, as far as the broker needs it.
type sender interface {
	Send(message any) error
}

// creatingCheckout is what a credential ask names for a session in creation.
type creatingCheckout struct {
	checkoutID   string
	githubRepoID int64
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
		creating: map[string]creatingCheckout{},
	}
}

// Creating lets the broker answer for a session whose create is running,
// before the session service has a record of it; the returned func ends
// that, once the create has landed or failed.
func (b *credentialBroker) Creating(sessionID, checkoutID string, githubRepoID int64) func() {
	b.mu.Lock()
	b.creating[sessionID] = creatingCheckout{checkoutID: checkoutID, githubRepoID: githubRepoID}
	b.mu.Unlock()
	return func() {
		b.mu.Lock()
		delete(b.creating, sessionID)
		b.mu.Unlock()
	}
}

// checkout is the checkout a session's credential is for: the recorded
// session's, or the one its running create named.
func (b *credentialBroker) checkout(sessionID string) (string, int64, bool) {
	if session, err := b.sessions(sessionID); err == nil && session.CheckoutID != "" {
		return session.CheckoutID, session.GithubRepoID, true
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	pending, ok := b.creating[sessionID]
	if !ok || pending.checkoutID == "" {
		return "", 0, false
	}
	return pending.checkoutID, pending.githubRepoID, true
}

// Get answers the helper for one session: the cached token while it is fresh,
// otherwise one asked for on the link and unsealed here.
func (b *credentialBroker) Get(ctx context.Context, sessionID string) (string, error) {
	if sessionID == "" {
		return "", errNoCredential
	}
	b.mu.Lock()
	cached, ok := b.tokens[sessionID]
	b.mu.Unlock()
	if ok && b.now().Add(tokenRefreshMargin).Before(cached.expiresAt) {
		return cached.token, nil
	}
	checkoutID, githubRepoID, ok := b.checkout(sessionID)
	if !ok {
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
		CheckoutID: checkoutID, GithubRepoID: githubRepoID,
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

// Revoke drops a session's token early, as `credentials.revoke` asks.
func (b *credentialBroker) Revoke(sessionID string) {
	b.mu.Lock()
	delete(b.tokens, sessionID)
	b.mu.Unlock()
}

// Forget drops every token: what a closed session and a new link call for.
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
