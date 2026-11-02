package transcript

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// How long one read of OpenCode's API may take, and how much of its answer
// is read.
const (
	openCodeTimeout = 10 * time.Second
	openCodeReadMax = 64 << 20
)

// errOpenCodeAnswer is an answer from OpenCode's API that is not a 200.
var errOpenCodeAnswer = errors.New("opencode answered")

// openCodeAPI is the few calls the chat makes on OpenCode's local API.
type openCodeAPI struct {
	base   string
	server domain.AgentServer
	http   *http.Client
}

func (a openCodeAPI) request(ctx context.Context, path string, query url.Values) (*http.Request, error) {
	target := a.base + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(domain.AgentServerUser, a.server.Password)
	return req, nil
}

func (a openCodeAPI) get(ctx context.Context, path string, query url.Values, out any) error {
	ctx, cancel := context.WithTimeout(ctx, openCodeTimeout)
	defer cancel()
	req, err := a.request(ctx, path, query)
	if err != nil {
		return err
	}
	resp, err := a.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w %d for %s", errOpenCodeAnswer, resp.StatusCode, path)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, openCodeReadMax)).Decode(out)
}

// events reads OpenCode's event stream until it ends, calling changed for
// each event about a session or a message. Only the head of an event's data
// is read (eventType): a part's event carries the whole part.
func (a openCodeAPI) events(ctx context.Context, changed func()) error {
	req, err := a.request(ctx, "/event", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	resp, err := a.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w %d for /event", errOpenCodeAnswer, resp.StatusCode)
	}
	reader := bufio.NewReaderSize(resp.Body, 16<<10)
	continued := false
	for {
		line, prefix, err := reader.ReadLine()
		if err != nil {
			return err
		}
		head := !continued
		continued = prefix
		if !head || !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		kind := eventType(bytes.TrimSpace(line[len("data:"):]))
		if strings.HasPrefix(kind, "message.") || strings.HasPrefix(kind, "session.") {
			changed()
		}
	}
}

// eventType is the `type` of an event's data, read off its head by a JSON
// tokenizer rather than matched as text, so spacing and the order of the keys
// before it do not matter. The data of a part's event can be megabytes and
// only its head is at hand: a type that is not in it reads as none, and the
// follower's slower poll still sees the change.
func eventType(data []byte) string {
	decoder := json.NewDecoder(bytes.NewReader(data))
	if open, err := decoder.Token(); err != nil || open != json.Delim('{') {
		return ""
	}
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return ""
		}
		if key == "type" {
			var kind string
			if decoder.Decode(&kind) != nil {
				return ""
			}
			return kind
		}
		var skipped json.RawMessage
		if decoder.Decode(&skipped) != nil {
			return ""
		}
	}
	return ""
}
