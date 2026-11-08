package domain

import (
	"strings"
	"testing"
	"time"
)

func received(chatType string, sentAt time.Time) Received {
	return Received{
		UpdateID: 7, IsMessage: true, ID: "42", ChatID: "-1001", ChatType: chatType, ChatName: "Shop team",
		SenderID: "123", SenderName: "Marta", Text: "hi", SentAt: sentAt,
	}
}

// What reaches the control plane is a new message in a person's or a group's
// chat: a channel post, an edit (no message) or a join (no text, no media)
// would make the bot answer something nobody wrote to it.
func TestAdmitKeepsOnlyMessagesPeopleWrote(t *testing.T) {
	now := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		r    Received
		ok   bool
		kind ChatKind
	}{
		{"private", received(TypePrivate, now), true, ChatDirect},
		{"group", received(TypeGroup, now), true, ChatGroup},
		{"supergroup", received(TypeSupergroup, now), true, ChatGroup},
		{"channel post", received(TypeChannel, now), false, ""},
		{"not a message", func() Received { r := received(TypePrivate, now); r.IsMessage = false; return r }(), false, ""},
		{"service message", func() Received { r := received(TypeGroup, now); r.Text = ""; return r }(), false, ""},
		{"media without caption", func() Received { r := received(TypeGroup, now); r.Text, r.Media = "", MediaPhoto; return r }(), true, ChatGroup},
	}
	for _, c := range cases {
		got, ok := Admit(c.r, now, false)
		if ok != c.ok || (ok && got.ChatKind != c.kind) {
			t.Errorf("%s: ok=%v kind=%q", c.name, ok, got.ChatKind)
		}
		if ok && got.Key != "-1001/42" {
			t.Errorf("%s: key %q", c.name, got.Key)
		}
	}
}

// A fresh bot drops the backlog a token brings from elsewhere; a host
// resuming its own offset keeps what it missed while it was down.
func TestAdmitDropsAnOldBacklogOnlyWhenFresh(t *testing.T) {
	now := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	old := received(TypePrivate, now.Add(-time.Hour))
	if _, ok := Admit(old, now, true); ok {
		t.Fatal("a fresh bot handed on an hour-old message")
	}
	if _, ok := Admit(old, now, false); !ok {
		t.Fatal("a resumed bot dropped a message it missed")
	}
}

// A caption past the wire's limit is cut, counted in UTF-16 as the control
// plane counts it, so a batch is never refused there.
func TestCutTextFitsTheWire(t *testing.T) {
	long := strings.Repeat("😀", TextMaxChars)
	cut := CutText(long)
	if utf16Len(cut) > TextMaxChars || !strings.HasSuffix(cut, CutMark) {
		t.Fatalf("cut to %d units", utf16Len(cut))
	}
}
