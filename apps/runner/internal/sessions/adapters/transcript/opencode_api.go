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
	"strconv"
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

// sessions is OpenCode's root conversations for directory.
func (a openCodeAPI) sessions(ctx context.Context, directory string) ([]openCodeSession, error) {
	query := url.Values{"roots": {"true"}}
	if directory != "" {
		query.Set("directory", directory)
	}
	var sessions []openCodeSession
	if err := a.get(ctx, "/session", query, &sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}

// messages is a conversation's messages through OpenCode's API, which pages
// from the newest when asked for a limit.
func (a openCodeAPI) messages(ctx context.Context, session string, limit int) ([]openCodeMessage, error) {
	var query url.Values
	if limit > 0 {
		query = url.Values{"limit": {strconv.Itoa(limit)}}
	}
	var messages []openCodeMessage
	if err := a.get(ctx, "/session/"+url.PathEscape(session)+"/message", query, &messages); err != nil {
		return nil, err
	}
	return messages, nil
}

// events reads OpenCode's event stream until it ends, calling changed for
// each event about a session or a message with the conversation it names
// ("" when its head does not say). Only the head of an event's data is read
// (eventOf): a part's event carries the whole part.
//
// The stream is this OpenCode process's own: another OpenCode writing to the
// same store, in the same folder, says nothing on it. That is how the chat
// tells the session's conversation from another's (openCodeFollower.conversation).
func (a openCodeAPI) events(ctx context.Context, changed func(conversation string)) error {
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
		kind, conversation := eventOf(bytes.TrimSpace(line[len("data:"):]))
		if strings.HasPrefix(kind, "message.") || strings.HasPrefix(kind, "session.") {
			changed(conversation)
		}
	}
}

// eventOf is the `type` of an event's data and the conversation it is about,
// read off its head by a JSON tokenizer rather than matched as text, so
// spacing and the order of the keys do not matter. The conversation is
// `properties.sessionID`, or that of the message or part it carries, or, for
// an event about a conversation itself, its `info.id`. The data of a part's
// event can be megabytes and only its head is at hand: what is not in it
// reads as none, and the follower's slower poll still sees the change.
func eventOf(data []byte) (kind, conversation string) {
	type frame struct {
		object, wantKey bool
		key             string
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	if open, err := decoder.Token(); err != nil || open != json.Delim('{') {
		return "", ""
	}
	var infoID string
	frames := []frame{{object: true, wantKey: true}}
	for len(frames) > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		top := &frames[len(frames)-1]
		if delim, ok := token.(json.Delim); ok {
			switch delim {
			case '{', '[':
				frames = append(frames, frame{object: delim == '{', wantKey: true})
			default:
				frames = frames[:len(frames)-1]
				if n := len(frames); n > 0 && frames[n-1].object {
					frames[n-1].wantKey = true
				}
			}
			continue
		}
		if top.object && top.wantKey {
			top.key, _ = token.(string)
			top.wantKey = false
			continue
		}
		if top.object {
			top.wantKey = true
		}
		value, ok := token.(string)
		if !ok {
			continue
		}
		path := make([]string, len(frames))
		for i, f := range frames {
			path[i] = "[]"
			if f.object {
				path[i] = f.key
			}
		}
		switch strings.Join(path, ".") {
		case "type":
			kind = value
		case "properties.sessionID", "properties.info.sessionID", "properties.part.sessionID":
			if conversation == "" {
				conversation = value
			}
		case "properties.info.id":
			infoID = value
		}
	}
	if conversation == "" && strings.HasPrefix(kind, "session.") {
		conversation = infoID
	}
	return kind, conversation
}
