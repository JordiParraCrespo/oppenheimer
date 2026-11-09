// Package botapi is the host's Telegram bot on Telegram's Bot API: four
// HTTPS calls on net/http, with no library (product/next-steps/telegram.md),
// and the store that keeps the bot's token and its outbox on disk.
package botapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/domain"
)

// DefaultBase is Telegram's Bot API.
const DefaultBase = "https://api.telegram.org"

// maxBody bounds what one answer may be: a hundred updates of 4,096
// characters each is well under it.
const maxBody = 8 << 20

// Client is app.BotAPI over HTTPS.
type Client struct {
	base string
	http *http.Client
}

var _ app.BotAPI = (*Client)(nil)

// NewClient is a client of the Bot API at base (DefaultBase when empty).
func NewClient(base string, httpClient *http.Client) *Client {
	if base == "" {
		base = DefaultBase
	}
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	return &Client{base: strings.TrimSuffix(base, "/"), http: httpClient}
}

// answer is every Bot API answer's envelope.
type answer struct {
	OK          bool            `json:"ok"`
	Result      json.RawMessage `json:"result"`
	ErrorCode   int             `json:"error_code"`
	Description string          `json:"description"`
	Parameters  struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters"`
}

// call posts body as JSON to method and decodes its result into out. No
// error it returns carries the token: the URL holds it, so a transport
// error is reported without the URL.
func (c *Client) call(ctx context.Context, token, method string, body, out any, timeout time.Duration) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/bot"+token+"/"+method, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("telegram %s: the request could not be made", method)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req) //nolint:gosec // the Bot API's base, set by the runner
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return fmt.Errorf("telegram %s: %w", method, err)
	}
	defer func() { _ = res.Body.Close() }()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxBody))
	if err != nil {
		return fmt.Errorf("telegram %s: %w", method, err)
	}
	var a answer
	if err := json.Unmarshal(raw, &a); err != nil {
		return fmt.Errorf("telegram %s: answered %d with no Bot API envelope", method, res.StatusCode)
	}
	if !a.OK {
		switch {
		case a.ErrorCode == http.StatusUnauthorized || res.StatusCode == http.StatusUnauthorized:
			return domain.ErrUnauthorized
		case a.ErrorCode == http.StatusTooManyRequests:
			after := time.Duration(a.Parameters.RetryAfter) * time.Second
			if after <= 0 {
				after = time.Second
			}
			return &domain.RetryAfter{After: after}
		}
		return &domain.Refused{Code: a.ErrorCode, Description: a.Description}
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(a.Result, out); err != nil {
		return fmt.Errorf("telegram %s: an unreadable result", method)
	}
	return nil
}

// callTimeout bounds a call that is not a long poll.
const callTimeout = 30 * time.Second

type user struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
}

func (u user) name() string { return strings.TrimSpace(u.FirstName + " " + u.LastName) }

// GetMe is the bot the token belongs to.
func (c *Client) GetMe(ctx context.Context, token string) (domain.Bot, error) {
	var me user
	if err := c.call(ctx, token, "getMe", struct{}{}, &me, callTimeout); err != nil {
		return domain.Bot{}, err
	}
	return domain.Bot{ID: strconv.FormatInt(me.ID, 10), Username: me.Username, Name: me.name()}, nil
}

// DeleteWebhook drops the bot's webhook and keeps the updates waiting.
func (c *Client) DeleteWebhook(ctx context.Context, token string) error {
	return c.call(ctx, token, "deleteWebhook", map[string]any{"drop_pending_updates": false}, nil, callTimeout)
}

// GetUpdates long-polls for new messages from offset on.
func (c *Client) GetUpdates(ctx context.Context, token string, offset int64, wait time.Duration) ([]app.Update, error) {
	var updates []update
	body := map[string]any{
		"offset": offset, "timeout": int(wait / time.Second), "limit": 100,
		"allowed_updates": []string{"message"},
	}
	if err := c.call(ctx, token, "getUpdates", body, &updates, wait+15*time.Second); err != nil {
		return nil, err
	}
	out := make([]app.Update, 0, len(updates))
	for _, u := range updates {
		out = append(out, u.received())
	}
	return out, nil
}

// SendMessage sends plain text, with no parse mode: nothing a bot writes is
// read as markup.
func (c *Client) SendMessage(ctx context.Context, token, chatID, text, replyToID string) (string, time.Time, error) {
	body := map[string]any{"chat_id": chatID, "text": text, "link_preview_options": map[string]any{"is_disabled": true}}
	if replyToID != "" {
		if id, err := strconv.ParseInt(replyToID, 10, 64); err == nil {
			body["reply_parameters"] = map[string]any{"message_id": id, "allow_sending_without_reply": true}
		}
	}
	var sent message
	if err := c.call(ctx, token, "sendMessage", body, &sent, callTimeout); err != nil {
		return "", time.Time{}, err
	}
	return strconv.FormatInt(sent.MessageID, 10), time.Unix(sent.Date, 0).UTC(), nil
}
