package cli

import (
	"context"
	"encoding/base64"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// grantingLink stands in for the control plane: it answers every ask with a
// grant, the way `credentials.processor.ts` does for a live checkout.
type grantingLink struct {
	broker *credentialBroker
	asked  []link.CredentialsToken
}

func (g *grantingLink) Send(message any) error {
	ask, ok := message.(link.CredentialsToken)
	if !ok {
		return errors.New("not a credential ask")
	}
	g.asked = append(g.asked, ask)
	go g.broker.Grant(link.CredentialsGrant{
		Type: "credentials.grant", RequestID: ask.RequestID, SessionID: ask.SessionID,
		CheckoutID: ask.CheckoutID,
		Sealed:     base64.StdEncoding.EncodeToString([]byte("token-for-" + ask.CheckoutID)),
		ExpiresAt:  time.Now().Add(time.Hour),
	})
	return nil
}

// The clone is the first step of a create. The broker asks the session
// service, which answers for the session while it is being created, so the
// clone of a private repository gets the session's token (#77) — and only
// that session's.
func TestTheBrokerAnswersForASessionWhileItsCloneRuns(t *testing.T) {
	h, svc, git, _ := newCreateHarness(t)
	control := &grantingLink{}
	broker := newCredentialBroker(control, func(sealed []byte) ([]byte, error) { return sealed, nil }, svc.Get)
	control.broker = broker

	h.Message(context.Background(), createMessage(t, "11111111-1111-4111-8111-111111111111"))
	waitForState(t, svc, sessionsdomain.StateCreating)

	token, err := broker.Get(context.Background(), sessionUnderTest)
	if err != nil || token != "token-for-c-1" {
		t.Fatalf("token = %q, err = %v", token, err)
	}
	if len(control.asked) != 1 || control.asked[0].CheckoutID != "c-1" || control.asked[0].GithubRepoID != 42 {
		t.Fatalf("the ask named %+v, want the create's checkout", control.asked)
	}

	for _, other := range []string{"", "someone-else"} {
		if _, err := broker.Get(context.Background(), other); !errors.Is(err, errNoCredential) {
			t.Fatalf("session %q: err = %v, want errNoCredential", other, err)
		}
	}
	if len(control.asked) != 1 {
		t.Fatalf("the control plane was asked for a session this host is not running: %+v", control.asked)
	}
	close(git.release)
	waitForState(t, svc, sessionsdomain.StateStarting)
}

// recordingLink collects the asks the broker sends, in place of the link.
type recordingLink struct {
	mu   sync.Mutex
	asks []link.CredentialsToken
	sent chan link.CredentialsToken
}

func (r *recordingLink) Send(message any) error {
	ask := message.(link.CredentialsToken)
	r.mu.Lock()
	r.asks = append(r.asks, ask)
	r.mu.Unlock()
	r.sent <- ask
	return nil
}

func (r *recordingLink) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.asks)
}

func newTestBroker() (*credentialBroker, *recordingLink) {
	sender := &recordingLink{sent: make(chan link.CredentialsToken, 16)}
	broker := newCredentialBroker(sender,
		func(sealed []byte) ([]byte, error) { return sealed, nil },
		func(id string) (sessionsdomain.Session, error) {
			return sessionsdomain.Session{ID: id, CheckoutID: "checkout-1", GithubRepoID: 42}, nil
		})
	return broker, sender
}

func grant(b *credentialBroker, ask link.CredentialsToken, token string) {
	b.Grant(link.CredentialsGrant{
		Type: "credentials.grant", RequestID: ask.RequestID, SessionID: ask.SessionID,
		Sealed: base64.StdEncoding.EncodeToString([]byte(token)), ExpiresAt: time.Now().Add(time.Hour),
	})
}

type answer struct {
	token string
	err   error
}

func TestConcurrentAsksForOneSessionShareOneRequest(t *testing.T) {
	broker, sender := newTestBroker()

	const callers = 10
	answers := make(chan answer, callers)
	for range callers {
		go func() {
			token, err := broker.Get(context.Background(), "session-1")
			answers <- answer{token, err}
		}()
	}
	ask := <-sender.sent
	// Give every caller time to reach the broker before the grant lands, so
	// they are all waiting on an ask rather than reading the cache.
	time.Sleep(50 * time.Millisecond)
	grant(broker, ask, "ghs_token")

	for range callers {
		got := <-answers
		if got.err != nil || got.token != "ghs_token" {
			t.Fatalf("answer = %+v, want the granted token", got)
		}
	}
	if n := sender.count(); n != 1 {
		t.Fatalf("credentials.token sent %d times, want 1", n)
	}
	// And the next caller is answered from the cache.
	if token, err := broker.Get(context.Background(), "session-1"); err != nil || token != "ghs_token" || sender.count() != 1 {
		t.Fatalf("cached = %q, %v; asks = %d", token, err, sender.count())
	}
}

func TestACancelledCallerDoesNotFailTheOthers(t *testing.T) {
	broker, sender := newTestBroker()

	first, cancelFirst := context.WithCancel(context.Background())
	firstDone := make(chan answer, 1)
	go func() {
		token, err := broker.Get(first, "session-1")
		firstDone <- answer{token, err}
	}()
	ask := <-sender.sent

	secondDone := make(chan answer, 1)
	go func() {
		token, err := broker.Get(context.Background(), "session-1")
		secondDone <- answer{token, err}
	}()
	time.Sleep(50 * time.Millisecond) // let the second caller join the ask
	// The one that started the ask gives up; the ask carries on.
	cancelFirst()
	if got := <-firstDone; got.err == nil {
		t.Fatalf("the cancelled caller got %+v, want an error", got)
	}
	grant(broker, ask, "ghs_token")

	if got := <-secondDone; got.err != nil || got.token != "ghs_token" {
		t.Fatalf("the other caller got %+v, want the token", got)
	}
	if n := sender.count(); n != 1 {
		t.Fatalf("credentials.token sent %d times, want 1", n)
	}
}

// A prepare's token arrives with its command: git under the prepare's identity
// is answered from it without an ask on the link, and nothing is answered once
// the command has ended.
func TestAPreparesTokenIsHeldForItsGitAndNoLonger(t *testing.T) {
	broker, sender := newTestBroker()
	id := preparePrefix + "cmd-1"
	broker.Hold(id, "ghs_prepare", time.Now().Add(time.Hour))

	token, err := broker.Get(context.Background(), id)
	if err != nil || token != "ghs_prepare" {
		t.Fatalf("Get = %q, %v; want the held token", token, err)
	}
	if sender.count() != 0 {
		t.Fatal("a held token was asked for on the link")
	}

	broker.Forget(id)
	if _, err := broker.Get(context.Background(), id); err == nil {
		t.Fatal("a prepare's token outlived its command")
	}
	if sender.count() != 0 {
		t.Fatal("a prepare with no token asked the link for one")
	}
}
