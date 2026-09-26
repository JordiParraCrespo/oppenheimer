package cli

import (
	"context"
	"encoding/base64"
	"errors"
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

func newTestBroker() (*credentialBroker, *grantingLink) {
	control := &grantingLink{}
	noSessions := func(id string) (sessionsdomain.Session, error) {
		return sessionsdomain.Session{}, sessionsdomain.ErrNotFound.WithDetail("no session %q on this host", id)
	}
	broker := newCredentialBroker(control, func(sealed []byte) ([]byte, error) { return sealed, nil }, noSessions)
	control.broker = broker
	return broker, control
}

// The clone is the first step of a create, before the session is recorded:
// a private repository's clone must still get the session's token (#77).
func TestTheBrokerAnswersForASessionWhoseCreateIsRunning(t *testing.T) {
	broker, control := newTestBroker()

	done := broker.Creating("session-1", "checkout-1", 42)
	token, err := broker.Get(context.Background(), "session-1")
	done()

	if err != nil || token != "token-for-checkout-1" {
		t.Fatalf("token = %q, err = %v", token, err)
	}
	if len(control.asked) != 1 || control.asked[0].CheckoutID != "checkout-1" || control.asked[0].GithubRepoID != 42 {
		t.Fatalf("the ask named %+v, want the create's checkout", control.asked)
	}
}

func TestTheBrokerHasNothingForASessionNeitherRecordedNorBeingCreated(t *testing.T) {
	broker, control := newTestBroker()

	done := broker.Creating("session-1", "checkout-1", 42)
	done()

	for _, id := range []string{"", "session-1", "someone-else"} {
		if _, err := broker.Get(context.Background(), id); !errors.Is(err, errNoCredential) {
			t.Fatalf("session %q: err = %v, want errNoCredential", id, err)
		}
	}
	if len(control.asked) != 0 {
		t.Fatalf("the control plane was asked %d times for sessions this host is not running", len(control.asked))
	}
}
