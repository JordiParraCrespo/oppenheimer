package cloud

// Codex cloud, on the service ChatGPT's current Codex Cloud runs on: a
// thread in one of the account's environments, started and followed with the
// host's own ChatGPT sign-in, the one `codex login` keeps. It is the service
// Codex's own client speaks (openai/codex, codex-rs/cloud-client, read at
// c0cc9fc on 2026-11-12; product/research/cloud-agents.md §7):
//
//	ThreadService/Prewarm         a thread, in an environment
//	ThreadService/AddUserMessage  the task, as its first message
//	ThreadService/ListTurns       where its latest turn stands
//
// gRPC over HTTP/2 at codex-cloud-backend.chatgpt.com, the bearer and the
// account id as headers. OpenAI has not published it: the messages below
// carry only the fields Codex's client sends and reads, by their numbers, and
// a field it adds is ignored here.
//
// The budget. OpenAI publishes no limit for this service; it counts against
// the ChatGPT account the host is signed in as, so that is the bucket. A
// start is two calls (Prewarm, AddUserMessage); following one is one
// ListTurns a minute per unsettled task (internal/cli/link_cloud_codex.go).
// "Stop" is HTTP 429 or gRPC RESOURCE_EXHAUSTED: the account is paused for
// the answer's Retry-After (a minute when it names none), nothing is sent for
// it until then, and the refusal is SESS_011.
//
// `codex cloud exec` is not used: it reaches only the environments ChatGPT
// now calls Codex Cloud (Legacy), and the host's `codex` is needed only for
// its sign-in.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/protobuf/encoding/protowire"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The statuses a Codex cloud task is reported in, as the host's ledger keeps
// them.
const (
	// CodexPending is a task queued or running.
	CodexPending = "pending"
	// CodexReady is a finished task whose diff is ready to apply.
	CodexReady = "ready"
	// CodexApplied is a finished task whose diff was applied somewhere: a
	// status only the CLI this runner used to drive reported, kept so a
	// ledger written then still reads as settled.
	CodexApplied = "applied"
	// CodexError is a task that failed or was stopped.
	CodexError = "error"
)

// CodexSettled reports whether a task's status will not change again on its
// own: finished or failed.
func CodexSettled(status string) bool {
	return status == CodexReady || status == CodexApplied || status == CodexError
}

// CodexDefaultEnvironment is the environment a thread for a repository starts
// in when none is picked: Codex's own default, with the repository checked
// out in it, as Codex's terminal starts a cloud thread for the project it is
// opened in.
const CodexDefaultEnvironment = "asenvcfg_base"

// codexOrigin is where the service answers.
const codexOrigin = "https://codex-cloud-backend.chatgpt.com"

// codexService is the gRPC service's path.
const codexService = "/oaiproto.codex_app_server_backend.ThreadService/"

// Codex starts and follows threads in Codex cloud with the host's ChatGPT
// sign-in. The zero value reads the sign-in where the CLI keeps it and talks
// to ChatGPT's service.
type Codex struct {
	// Home is the CLI's home, where its sign-in is; empty is where the CLI
	// looks itself ($CODEX_HOME, else ~/.codex).
	Home string
	// Origin is the service's scheme and host; empty is ChatGPT's.
	Origin string
	// HTTP makes the calls, over HTTP/2; nil is http.DefaultClient, which
	// negotiates it.
	HTTP *http.Client
	// Timeout bounds one call; zero is thirty seconds.
	Timeout time.Duration
	// Now is the clock a sign-in's expiry is read against; nil is time.Now.
	Now func() time.Time
}

// Start creates a thread for repository (`owner/name`) in environment, an
// environment id from ChatGPT's Codex Cloud settings, or in Codex's default
// with the repository checked out when it is empty, and sends prompt as its
// first message. branch is the one the task should start from: the service
// checks out the repository's default branch, so it is said in the message.
// It answers once Codex has admitted the message.
func (c Codex) Start(ctx context.Context, repository, branch, prompt, environment string) (Started, error) {
	auth, err := c.signIn()
	if err != nil {
		return Started{}, err
	}
	owner, name, ok := strings.Cut(strings.ToLower(repository), "/")
	if environment == "" && (!ok || owner == "" || name == "") {
		return Started{}, domain.ErrCodexCloudStart.WithDetail("%q is not a GitHub repository's owner/name", repository)
	}
	raw, err := c.call(ctx, auth, "Prewarm", prewarmRequest(owner, name, environment))
	if err != nil {
		if environment != "" && isEnvironmentRefusal(err) {
			return Started{}, domain.ErrCodexCloudEnvironment.WithDetail(
				"Codex has no environment %s that this ChatGPT account can start a task in: %s", environment, grpcMessage(err))
		}
		return Started{}, err
	}
	threadID := threadIDOf(raw)
	if threadID == "" {
		return Started{}, domain.ErrCodexCloudStart.WithDetail("Codex started a thread and named none")
	}
	if _, err := c.call(ctx, auth, "AddUserMessage", addMessageRequest(threadID, firstMessage(branch, prompt))); err != nil {
		return Started{}, err
	}
	return Started{ID: threadID, URL: "codex://threads/" + url.PathEscape(threadID)}, nil
}

// firstMessage is the task, with the branch it starts from said first.
func firstMessage(branch, prompt string) string {
	if branch == "" {
		return prompt
	}
	return "Start from the `" + branch + "` branch.\n\n" + prompt
}

// Status answers where a thread's latest turn stands: pending while it runs
// or before it has one, ready once it completed, error once it failed or was
// stopped.
func (c Codex) Status(ctx context.Context, threadID string) (string, error) {
	auth, err := c.signIn()
	if err != nil {
		return "", err
	}
	raw, err := c.call(ctx, auth, "ListTurns", latestTurnRequest(threadID))
	if err != nil {
		return "", err
	}
	switch latestTurnStatus(raw) {
	case turnCompleted:
		return CodexReady, nil
	case turnFailed, turnInterrupted:
		return CodexError, nil
	default:
		return CodexPending, nil
	}
}

// The status numbers of a turn (codex-rs/cloud-client/src/transcript.rs).
const (
	turnCompleted   = 1
	turnInterrupted = 2
	turnFailed      = 3
)

// prewarmRequest is ThreadService/Prewarm's request: one managed environment,
// the picked one, or the default with the repository's checkout.
func prewarmRequest(owner, name, environment string) []byte {
	var managed []byte
	if environment != "" {
		managed = appendString(managed, 1, environment)
	} else {
		var origin, repositories, overrides []byte
		origin = appendString(origin, 5, "https://github.com/"+owner+"/"+name)
		repositories = appendMessage(repositories, 1, origin)
		overrides = appendMessage(overrides, 1, repositories)
		overrides = appendString(overrides, 2, name)
		managed = appendString(managed, 1, CodexDefaultEnvironment)
		managed = appendString(managed, 2, "/workspace/"+owner+"/"+name)
		managed = appendMessage(managed, 3, overrides)
	}
	var selection, list, plugins, req []byte
	selection = appendMessage(selection, 1, managed)
	list = appendMessage(list, 1, selection)
	plugins = appendString(plugins, 1, "codex")
	req = appendMessage(req, 10, list)
	req = appendMessage(req, 28, plugins)
	if environment == "" {
		req = protowire.AppendTag(req, 29, protowire.VarintType)
		req = protowire.AppendVarint(req, 1)
	}
	return req
}

// addMessageRequest is ThreadService/AddUserMessage's request: the text as
// the person's own message, started now if the thread is idle. Its id is the
// thread's, so a call sent again is the same message.
func addMessageRequest(threadID, text string) []byte {
	var textPart, part, input, req []byte
	textPart = appendString(textPart, 1, text)
	part = appendMessage(part, 1, textPart)
	input = appendMessage(input, 1, part)
	req = appendString(req, 4, "oppenheimer-"+threadID)
	req = appendMessage(req, 11, input)
	req = appendString(req, 23, threadID)
	req = appendString(req, 25, "user")
	req = protowire.AppendTag(req, 30, protowire.VarintType)
	req = protowire.AppendVarint(req, 3)
	return req
}

// latestTurnRequest is ThreadService/ListTurns' request for the newest turn.
func latestTurnRequest(threadID string) []byte {
	var req []byte
	req = appendString(req, 1, threadID)
	req = protowire.AppendTag(req, 3, protowire.VarintType)
	req = protowire.AppendVarint(req, 1)
	req = protowire.AppendTag(req, 4, protowire.VarintType)
	req = protowire.AppendVarint(req, 2)
	return req
}

// threadIDOf reads the thread's id off Prewarm's answer: its thread (14),
// and that thread's id (14).
func threadIDOf(raw []byte) string {
	thread := firstBytes(raw, 14)
	return string(firstBytes(thread, 14))
}

// latestTurnStatus reads the status (8) of the first turn in ListTurns'
// page: its rows (1), their first value (1); zero when there is none.
func latestTurnStatus(raw []byte) uint64 {
	rows := firstBytes(raw, 1)
	turn := firstBytes(rows, 1)
	status, _ := firstVarint(turn, 8)
	return status
}

func appendString(b []byte, field protowire.Number, s string) []byte {
	b = protowire.AppendTag(b, field, protowire.BytesType)
	return protowire.AppendString(b, s)
}

func appendMessage(b []byte, field protowire.Number, m []byte) []byte {
	b = protowire.AppendTag(b, field, protowire.BytesType)
	return protowire.AppendBytes(b, m)
}

// firstBytes is the first length-delimited value of field in a message, or
// nil; a malformed message reads as having none.
func firstBytes(b []byte, field protowire.Number) []byte {
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		if n < 0 {
			return nil
		}
		b = b[n:]
		if num == field && typ == protowire.BytesType {
			v, m := protowire.ConsumeBytes(b)
			if m < 0 {
				return nil
			}
			return v
		}
		m := protowire.ConsumeFieldValue(num, typ, b)
		if m < 0 {
			return nil
		}
		b = b[m:]
	}
	return nil
}

// firstVarint is the first varint value of field in a message.
func firstVarint(b []byte, field protowire.Number) (uint64, bool) {
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		if n < 0 {
			return 0, false
		}
		b = b[n:]
		if num == field && typ == protowire.VarintType {
			v, m := protowire.ConsumeVarint(b)
			return v, m >= 0
		}
		m := protowire.ConsumeFieldValue(num, typ, b)
		if m < 0 {
			return 0, false
		}
		b = b[m:]
	}
	return 0, false
}

// grpcError is the service refusing a call: its gRPC status and message.
type grpcError struct {
	code    int
	message string
}

func (e *grpcError) Error() string {
	return fmt.Sprintf("Codex cloud answered gRPC status %d: %s", e.code, e.message)
}

// The gRPC status codes this adapter tells apart.
const (
	grpcInvalidArgument    = 3
	grpcNotFound           = 5
	grpcPermissionDenied   = 7
	grpcResourceExhausted  = 8
	grpcFailedPrecondition = 9
	grpcUnauthenticated    = 16
)

// isEnvironmentRefusal reports whether err is the service refusing the
// environment a thread was asked for.
func isEnvironmentRefusal(err error) bool {
	var ge *grpcError
	if !errors.As(err, &ge) {
		return false
	}
	return ge.code == grpcNotFound || ge.code == grpcInvalidArgument || ge.code == grpcFailedPrecondition
}

func grpcMessage(err error) string {
	var ge *grpcError
	if errors.As(err, &ge) && ge.message != "" {
		return ge.message
	}
	return err.Error()
}

// call makes one unary gRPC call and answers the response message. A refusal
// is a problem: no sign-in is ErrCodexCloudSignIn, a refusal for rate is
// ErrCodexRateLimited, and any other is ErrCodexCloudStart in the service's
// words, wrapping the *grpcError when the service gave one.
func (c Codex) call(ctx context.Context, auth codexAuth, method string, message []byte) ([]byte, error) {
	account := auth.Tokens.AccountID
	if until := pausedUntil(account, c.now()); !until.IsZero() {
		return nil, rateLimited(until, c.now())
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	frame := make([]byte, 5, 5+len(message))
	binary.BigEndian.PutUint32(frame[1:], uint32(len(message))) //nolint:gosec // a request this adapter built, far under 4 GiB
	frame = append(frame, message...)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.origin()+codexService+method, bytes.NewReader(frame))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/grpc")
	req.Header.Set("TE", "trailers")
	req.Header.Set("Authorization", "Bearer "+auth.Tokens.AccessToken)
	req.Header.Set("ChatGPT-Account-Id", auth.Tokens.AccountID)
	req.Header.Set("User-Agent", "oppenheimer-runner")
	res, err := c.client().Do(req)
	if err != nil {
		return nil, domain.ErrCodexCloudStart.WithDetail("Codex cloud could not be reached: %v", err).WithCause(err)
	}
	defer func() { _ = res.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, domain.ErrCodexCloudStart.WithDetail("Codex cloud's answer was cut off: %v", err).WithCause(err)
	}
	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, codexSignIn("ChatGPT refused the host's Codex sign-in")
	case http.StatusTooManyRequests:
		until := c.now().Add(retryAfter(res.Header.Get("Retry-After"), c.now()))
		pause(account, until)
		return nil, rateLimited(until, c.now())
	default:
		return nil, domain.ErrCodexCloudStart.WithDetail("Codex cloud answered %s", res.Status)
	}
	if status := grpcStatus(res); status != "" && status != "0" {
		code, _ := strconv.Atoi(status)
		ge := &grpcError{code: code, message: grpcStatusMessage(res)}
		switch code {
		case grpcUnauthenticated:
			return nil, codexSignIn("ChatGPT refused the host's Codex sign-in: " + ge.message)
		case grpcResourceExhausted:
			until := c.now().Add(retryAfter(res.Header.Get("Retry-After"), c.now()))
			pause(account, until)
			return nil, rateLimited(until, c.now())
		case grpcPermissionDenied:
			return nil, domain.ErrCodexCloudStart.WithDetail(
				"This ChatGPT account cannot start Codex cloud tasks: %s", ge.message).WithCause(ge)
		}
		return nil, domain.ErrCodexCloudStart.WithDetail("%s", ge.message).WithCause(ge)
	}
	if len(body) < 5 || body[0] != 0 {
		return nil, domain.ErrCodexCloudStart.WithDetail("Codex cloud answered %s with no message", method)
	}
	size := binary.BigEndian.Uint32(body[1:5])
	if uint64(len(body)-5) < uint64(size) {
		return nil, domain.ErrCodexCloudStart.WithDetail("Codex cloud's answer to %s was cut off", method)
	}
	return body[5 : 5+size], nil
}

// codexRateLimitDefault is how long an account is paused after a refusal for
// rate that names no Retry-After.
const codexRateLimitDefault = time.Minute

// codexPauses holds, by ChatGPT account, until when ChatGPT asked the host
// not to call Codex cloud. Process-wide: every Codex value reads it.
var codexPauses = struct {
	sync.Mutex
	until map[string]time.Time
}{until: map[string]time.Time{}}

// pausedUntil answers until when account is paused, or the zero time.
func pausedUntil(account string, now time.Time) time.Time {
	codexPauses.Lock()
	defer codexPauses.Unlock()
	until := codexPauses.until[account]
	if !until.After(now) {
		delete(codexPauses.until, account)
		return time.Time{}
	}
	return until
}

// pause holds account until until, never shortening a longer pause.
func pause(account string, until time.Time) {
	codexPauses.Lock()
	defer codexPauses.Unlock()
	if until.After(codexPauses.until[account]) {
		codexPauses.until[account] = until
	}
}

// rateLimited is the refusal for an account paused until until.
func rateLimited(until, now time.Time) error {
	return domain.ErrCodexRateLimited.WithDetail(
		"ChatGPT is limiting how often Codex cloud is asked; try again in %s", until.Sub(now).Round(time.Second))
}

// retryAfter reads a Retry-After header in seconds or as an HTTP date.
func retryAfter(header string, now time.Time) time.Duration {
	if seconds, err := strconv.Atoi(strings.TrimSpace(header)); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	if at, err := http.ParseTime(header); err == nil && at.After(now) {
		return at.Sub(now)
	}
	return codexRateLimitDefault
}

// grpcStatus is the call's gRPC status, from its trailers or, for an answer
// that is only headers, its headers.
func grpcStatus(res *http.Response) string {
	if s := res.Trailer.Get("Grpc-Status"); s != "" {
		return s
	}
	return res.Header.Get("Grpc-Status")
}

func grpcStatusMessage(res *http.Response) string {
	m := res.Trailer.Get("Grpc-Message")
	if m == "" {
		m = res.Header.Get("Grpc-Message")
	}
	if decoded, err := url.PathUnescape(m); err == nil {
		m = decoded
	}
	if m == "" {
		return "no reason given"
	}
	return m
}

// codexSignIn is ErrCodexCloudSignIn with why, and what fixes it.
func codexSignIn(why string) error {
	return domain.ErrCodexCloudSignIn.WithDetail("%s. Run `codex login` on the host, as the account the runner runs as.", why)
}

// codexAuth is the part of $CODEX_HOME/auth.json a ChatGPT request needs.
type codexAuth struct {
	Tokens *struct {
		AccessToken string `json:"access_token"`
		AccountID   string `json:"account_id"`
	} `json:"tokens"`
}

// signIn reads the CLI's ChatGPT sign-in, refusing one that is missing,
// incomplete or past its expiry.
func (c Codex) signIn() (codexAuth, error) {
	home, err := c.home()
	if err != nil {
		return codexAuth{}, err
	}
	raw, err := os.ReadFile(filepath.Join(home, "auth.json")) //nolint:gosec // the CLI's own auth file, in its own home
	if errors.Is(err, os.ErrNotExist) {
		return codexAuth{}, codexSignIn("Codex on this host is not signed in to ChatGPT")
	}
	if err != nil {
		return codexAuth{}, domain.ErrCodexCloudStart.WithDetail("the host's Codex sign-in could not be read: %v", err).WithCause(err)
	}
	var auth codexAuth
	if err := json.Unmarshal(raw, &auth); err != nil {
		return codexAuth{}, domain.ErrCodexCloudStart.WithDetail("the host's Codex sign-in is not JSON: %v", err).WithCause(err)
	}
	if auth.Tokens == nil || auth.Tokens.AccessToken == "" || auth.Tokens.AccountID == "" {
		return codexAuth{}, codexSignIn("Codex on this host is signed in with an API key, or not at all; Codex cloud needs a ChatGPT sign-in")
	}
	if exp, ok := expiry(auth.Tokens.AccessToken); ok && !exp.After(c.now()) {
		return codexAuth{}, codexSignIn("The host's Codex sign-in to ChatGPT has expired; running `codex` once renews it")
	}
	return auth, nil
}

// expiry reads a JWT's exp without verifying it: only to say "expired"
// before ChatGPT does.
func expiry(token string) (time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, false
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if json.Unmarshal(payload, &claims) != nil || claims.Exp == 0 {
		return time.Time{}, false
	}
	return time.Unix(claims.Exp, 0), true
}

// home is the CLI's home: Home, else $CODEX_HOME, else ~/.codex, which is
// where the CLI itself looks.
func (c Codex) home() (string, error) {
	if c.Home != "" {
		return c.Home, nil
	}
	if env := os.Getenv("CODEX_HOME"); env != "" {
		return env, nil
	}
	user, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(user, ".codex"), nil
}

func (c Codex) origin() string {
	if c.Origin == "" {
		return codexOrigin
	}
	return strings.TrimRight(c.Origin, "/")
}

func (c Codex) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

func (c Codex) timeout() time.Duration {
	if c.Timeout <= 0 {
		return 30 * time.Second
	}
	return c.Timeout
}

func (c Codex) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}
