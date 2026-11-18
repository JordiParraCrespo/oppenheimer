package cli

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// fakeReplier records what it was asked to send.
type fakeReplier struct{ sent []string }

func (f *fakeReplier) Send(_ context.Context, cloudSessionID, text string) error {
	f.sent = append(f.sent, cloudSessionID+": "+text)
	return nil
}

func replyHarness(t *testing.T) (*linkHandler, *fakeReplier, *sentMessages) {
	t.Helper()
	replier := &fakeReplier{}
	client := &sentMessages{}
	h := &linkHandler{
		app:    &App{Paths: Paths{Home: t.TempDir()}, CloudReplies: replier},
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)), life: context.Background(),
		client: client,
	}
	return h, replier, client
}

var reply = link.CloudReply{
	Type: link.TypeCloudReply, CommandID: "c-1",
	CloudSessionID: "session_014a8EH8DJs95X1iK8ZH9Y82", Text: "Now tag the release",
}

func TestCloudReplyIsSentAndConfirmed(t *testing.T) {
	h, replier, client := replyHarness(t)
	h.cloudReply(context.Background(), reply, time.Now())

	if len(replier.sent) != 1 || replier.sent[0] != "session_014a8EH8DJs95X1iK8ZH9Y82: Now tag the release" {
		t.Fatalf("sent = %v", replier.sent)
	}
	if got, ok := client.sent[0].(link.CloudReplied); !ok || got.CommandID != "c-1" {
		t.Fatalf("answer = %+v", client.sent)
	}
}

// A reply that waited its whole budget behind another to the same session
// is refused unsent, so the control plane, which stops waiting at 60 s,
// hears before it would have to count the message as maybe sent.
func TestCloudReplyThatWaitedPastItsBudgetIsRefusedUnsent(t *testing.T) {
	h, replier, client := replyHarness(t)
	h.cloudReply(context.Background(), reply, time.Now().Add(-cloudReplyBudget))

	if len(replier.sent) != 0 {
		t.Fatalf("sent = %v, want nothing", replier.sent)
	}
	got, ok := client.sent[0].(link.CommandFailed)
	if !ok || got.CommandID != "c-1" || got.Code != sessionsdomain.ErrCloudReply.Code {
		t.Fatalf("answer = %+v, want SESS_020", client.sent)
	}
}
