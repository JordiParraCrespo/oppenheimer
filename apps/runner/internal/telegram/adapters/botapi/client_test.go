package botapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

const token = "7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"

// fakeTelegram answers the Bot API's methods with canned JSON, and records
// each call's body.
func fakeTelegram(t *testing.T, answers map[string]string) (*Client, map[string]map[string]any) {
	t.Helper()
	bodies := map[string]map[string]any{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefix := "/bot" + token + "/"
		if !strings.HasPrefix(r.URL.Path, prefix) {
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `{"ok":false,"error_code":404,"description":"Not Found"}`)
			return
		}
		method := strings.TrimPrefix(r.URL.Path, prefix)
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		bodies[method] = body
		answer, ok := answers[method]
		if !ok {
			t.Errorf("unexpected call to %s", method)
			answer = `{"ok":false,"error_code":400,"description":"unexpected"}`
		}
		_, _ = io.WriteString(w, answer)
	}))
	t.Cleanup(srv.Close)
	return NewClient(srv.URL, srv.Client()), bodies
}

// getMe names the bot; a 401 is ErrUnauthorized, which the service turns into
// TG_001 on connect and "revoked" while polling.
func TestGetMe(t *testing.T) {
	c, _ := fakeTelegram(t, map[string]string{
		"getMe": `{"ok":true,"result":{"id":7012345678,"is_bot":true,"first_name":"Shop","last_name":"helper","username":"shop_bot"}}`,
	})
	bot, err := c.GetMe(context.Background(), token)
	if err != nil || bot != (domain.Bot{ID: "7012345678", Username: "shop_bot", Name: "Shop helper"}) {
		t.Fatalf("%+v %v", bot, err)
	}
	refusing, _ := fakeTelegram(t, map[string]string{"getMe": `{"ok":false,"error_code":401,"description":"Unauthorized"}`})
	if _, err := refusing.GetMe(context.Background(), token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("401: %v", err)
	}
}

// getUpdates asks for messages only and reads each into the domain's shape:
// a group's title, a sender's name and username, a caption standing in for
// the text, the media's kind, the message replied to.
func TestGetUpdatesReadsMessages(t *testing.T) {
	c, bodies := fakeTelegram(t, map[string]string{"getUpdates": `{"ok":true,"result":[
		{"update_id":10,"message":{"message_id":42,"date":1800000000,
			"chat":{"id":-1001234567890,"type":"supergroup","title":"Shop team"},
			"from":{"id":123,"first_name":"Marta","last_name":"Vidal","username":"martav"},
			"caption":"the build","photo":[{"file_id":"x"}],"reply_to_message":{"message_id":41,"date":1,"chat":{"id":-1001234567890,"type":"supergroup"}}}},
		{"update_id":11,"message":{"message_id":7,"date":1800000001,"chat":{"id":123,"type":"private","first_name":"Marta"},
			"from":{"id":123,"first_name":"Marta"},"text":"hi"}},
		{"update_id":12,"edited_message":{"message_id":7,"date":1800000002,"chat":{"id":123,"type":"private"},"text":"hi!"}}
	]}`})
	updates, err := c.GetUpdates(context.Background(), token, 10, time.Second)
	if err != nil || len(updates) != 3 {
		t.Fatalf("%d %v", len(updates), err)
	}
	g := updates[0]
	if g.ChatID != "-1001234567890" || g.ChatType != "supergroup" || g.ChatName != "Shop team" || g.ID != "42" ||
		g.SenderName != "Marta Vidal" || g.SenderUsername != "martav" || g.Text != "the build" ||
		g.Media != domain.MediaPhoto || g.ReplyToID != "41" || !g.SentAt.Equal(time.Unix(1800000000, 0)) {
		t.Fatalf("group message: %+v", g)
	}
	if d := updates[1]; d.ChatName != "Marta" || d.Text != "hi" || d.Media != "" {
		t.Fatalf("direct message: %+v", d)
	}
	if e := updates[2]; e.IsMessage || e.UpdateID != 12 {
		t.Fatalf("an edit read as a message: %+v", e)
	}
	body := bodies["getUpdates"]
	if body["offset"] != float64(10) || body["timeout"] != float64(1) {
		t.Fatalf("poll body %v", body)
	}
	if allowed, _ := body["allowed_updates"].([]any); len(allowed) != 1 || allowed[0] != "message" {
		t.Fatalf("allowed_updates %v", body["allowed_updates"])
	}
}

// A send is plain text with no parse mode, so a bot's words are never read
// as markup, and a reply names the message it answers.
func TestSendMessageIsPlainText(t *testing.T) {
	c, bodies := fakeTelegram(t, map[string]string{
		"sendMessage": `{"ok":true,"result":{"message_id":43,"date":1800000005,"chat":{"id":-1001,"type":"group"}}}`,
	})
	id, at, err := c.SendMessage(context.Background(), token, "-1001", "*not bold*", "42")
	if err != nil || id != "43" || !at.Equal(time.Unix(1800000005, 0)) {
		t.Fatalf("%q %v %v", id, at, err)
	}
	body := bodies["sendMessage"]
	if _, set := body["parse_mode"]; set || body["chat_id"] != "-1001" || body["text"] != "*not bold*" {
		t.Fatalf("body %v", body)
	}
	if reply, _ := body["reply_parameters"].(map[string]any); reply["message_id"] != float64(42) {
		t.Fatalf("reply %v", body["reply_parameters"])
	}
}

// A 429 carries its retry_after; another refusal its description.
func TestRefusals(t *testing.T) {
	c, _ := fakeTelegram(t, map[string]string{
		"sendMessage": `{"ok":false,"error_code":429,"description":"Too Many Requests","parameters":{"retry_after":17}}`,
	})
	_, _, err := c.SendMessage(context.Background(), token, "1", "x", "")
	var retry *domain.RetryAfter
	if !errors.As(err, &retry) || retry.After != 17*time.Second {
		t.Fatalf("429: %v", err)
	}
	blocked, _ := fakeTelegram(t, map[string]string{
		"sendMessage": `{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}`,
	})
	_, _, err = blocked.SendMessage(context.Background(), token, "1", "x", "")
	var refused *domain.Refused
	if !errors.As(err, &refused) || refused.Code != 403 {
		t.Fatalf("403: %v", err)
	}
}

// The token is in the URL, so a transport error must not carry the URL:
// what the runner logs or tells the control plane never holds the token.
func TestErrorsNeverCarryTheToken(t *testing.T) {
	c := NewClient("http://127.0.0.1:1", nil)
	_, err := c.GetMe(context.Background(), token)
	if err == nil || strings.Contains(err.Error(), "AAHdq") {
		t.Fatalf("error %v", err)
	}
}
