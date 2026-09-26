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
