package cloud

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/protobuf/encoding/protowire"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// codexCall is one call the stand-in service took: its method, its message
// and its headers.
type codexCall struct {
	method  string
	message []byte
	header  http.Header
}

// standInCodex is a stand-in for Codex cloud's ThreadService over HTTP/2:
// answer says what each method answers, a message or a gRPC status.
type standInCodex struct {
	mu     sync.Mutex
	calls  []codexCall
	answer func(method string, message []byte) (reply []byte, status int, why string)
	// lose, when it says so, answers a call with a bad gateway: an answer
	// lost between the service and the host.
	lose func(method string) bool
}

func (s *standInCodex) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	method := strings.TrimPrefix(r.URL.Path, codexService)
	var message []byte
	if len(body) >= 5 {
		message = body[5:]
	}
	s.mu.Lock()
	s.calls = append(s.calls, codexCall{method: method, message: message, header: r.Header.Clone()})
	s.mu.Unlock()
	reply, status, why := s.answer(method, message)
	if s.lose != nil && s.lose(method) {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/grpc")
	w.Header().Set("Trailer", "Grpc-Status, Grpc-Message")
	w.WriteHeader(http.StatusOK)
	if status == 0 {
		frame := make([]byte, 5)
		binary.BigEndian.PutUint32(frame[1:], uint32(len(reply))) //nolint:gosec // a test reply
		_, _ = w.Write(append(frame, reply...))
	}
	w.Header().Set("Grpc-Status", fmt.Sprint(status))
	w.Header().Set("Grpc-Message", why)
}

func (s *standInCodex) taken() []codexCall {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]codexCall(nil), s.calls...)
}

// codexServer starts the stand-in over TLS and HTTP/2, and answers a Codex
// that talks to it, signed in as account (each test its own, so a pause one
// test causes is not another's).
func codexServer(t *testing.T, answer func(method string, message []byte) ([]byte, int, string)) (*standInCodex, Codex) {
	t.Helper()
	service := &standInCodex{answer: answer}
	server := httptest.NewUnstartedServer(service)
	server.EnableHTTP2 = true
	server.StartTLS()
	t.Cleanup(server.Close)
	return service, Codex{
		Command: filepath.Join(t.TempDir(), "no-codex"),
		Home:    signedIn(t, token(time.Now().Add(time.Hour))),
		Origin:  server.URL, HTTP: server.Client(),
	}
}

// token is an access token as ChatGPT mints one: a JWT whose payload says
// when it expires.
func token(exp time.Time) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"exp": %d}`, exp.Unix())))
	return "e30." + payload + ".sig"
}

// signedIn writes a ChatGPT sign-in as `codex login` keeps it, for an account
// of the test's own, and answers the Codex home that holds it.
func signedIn(t *testing.T, access string) string {
	t.Helper()
	home := t.TempDir()
	auth := fmt.Sprintf(`{"OPENAI_API_KEY": null, "tokens": {"id_token": "x", "access_token": %q, "refresh_token": "r", "account_id": %q}}`,
		access, "acc-"+t.Name())
	if err := os.WriteFile(filepath.Join(home, "auth.json"), []byte(auth), 0o600); err != nil {
		t.Fatal(err)
	}
	return home
}

// prewarmed is Prewarm's answer for a thread named id.
func prewarmed(id string) []byte {
	var thread, reply []byte
	thread = appendString(thread, 14, id)
	reply = appendMessage(reply, 14, thread)
	return reply
}

// turns is ListTurns' answer with one turn per status, newest first.
func turns(statuses ...uint64) []byte {
	var rows, reply []byte
	for _, status := range statuses {
		var turn []byte
		turn = appendString(turn, 4, "turn-1")
		turn = protowire.AppendTag(turn, 8, protowire.VarintType)
		turn = protowire.AppendVarint(turn, status)
		rows = appendMessage(rows, 1, turn)
	}
	reply = appendMessage(reply, 1, rows)
	return reply
}

// starts answers a start: a thread named thr_1, and the message admitted.
func starts(method string, _ []byte) ([]byte, int, string) {
	if method == "Prewarm" {
		return prewarmed("thr_1"), 0, ""
	}
	return nil, 0, ""
}

func codeOf(t *testing.T, err error) string {
	t.Helper()
	pe := problem.From(err)
	if pe == nil {
		t.Fatalf("err = %v, want a problem", err)
	}
	return pe.Code
}

// A task with no environment picked starts as Codex's own terminal starts a
// cloud thread for a project: Codex's default environment with the
// repository checked out, and the task as the person's first message, which
// says the branch to start from. Both calls carry the host's ChatGPT sign-in.
func TestCodexStartRunsTheTaskInTheDefaultEnvironmentWithTheRepository(t *testing.T) {
	service, codex := codexServer(t, starts)

	started, err := codex.Start(context.Background(), "Acme-Labs/XRP-Mobile", "develop", "Fix the wallet list", "")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if started.ID != "thr_1" || started.URL != "codex://threads/thr_1" {
		t.Fatalf("started = %+v", started)
	}
	calls := service.taken()
	if len(calls) != 2 || calls[0].method != "Prewarm" || calls[1].method != "AddUserMessage" {
		t.Fatalf("calls = %v", calls)
	}
	for _, call := range calls {
		if !strings.HasPrefix(call.header.Get("Authorization"), "Bearer e30.") ||
			call.header.Get("ChatGPT-Account-Id") != "acc-"+t.Name() ||
			call.header.Get("Content-Type") != "application/grpc" {
			t.Fatalf("%s headers = %v", call.method, call.header)
		}
	}

	managed := firstBytes(firstBytes(firstBytes(calls[0].message, 10), 1), 1)
	overrides := firstBytes(managed, 3)
	origin := firstBytes(firstBytes(firstBytes(overrides, 1), 1), 5)
	if string(firstBytes(managed, 1)) != CodexDefaultEnvironment ||
		string(firstBytes(managed, 2)) != "/workspace/acme-labs/xrp-mobile" ||
		string(origin) != "https://github.com/acme-labs/xrp-mobile" ||
		string(firstBytes(overrides, 2)) != "xrp-mobile" {
		t.Fatalf("environment = id %q, cwd %q, origin %q, name %q",
			firstBytes(managed, 1), firstBytes(managed, 2), origin, firstBytes(overrides, 2))
	}
	if deferred, _ := firstVarint(calls[0].message, 29); deferred != 1 {
		t.Fatalf("deferred environment = %d, want 1", deferred)
	}

	text := firstBytes(firstBytes(firstBytes(firstBytes(calls[1].message, 11), 1), 1), 1)
	if string(firstBytes(calls[1].message, 23)) != "thr_1" ||
		string(firstBytes(calls[1].message, 4)) != "oppenheimer-thr_1" ||
		string(text) != "Start from the `develop` branch.\n\nFix the wallet list" {
		t.Fatalf("message = thread %q, id %q, text %q", firstBytes(calls[1].message, 23), firstBytes(calls[1].message, 4), text)
	}
	if mode, _ := firstVarint(calls[1].message, 30); mode != 3 {
		t.Fatalf("mode = %d, want start-if-idle (3)", mode)
	}
}

// A picked environment is the one the thread starts in, by its id alone: it
// already names its repositories.
func TestCodexStartRunsTheTaskInThePickedEnvironment(t *testing.T) {
	service, codex := codexServer(t, starts)

	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "asenvcfg_oppenheimer"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	managed := firstBytes(firstBytes(firstBytes(service.taken()[0].message, 10), 1), 1)
	if string(firstBytes(managed, 1)) != "asenvcfg_oppenheimer" || firstBytes(managed, 3) != nil {
		t.Fatalf("environment = %q, overrides %q", firstBytes(managed, 1), firstBytes(managed, 3))
	}
	if _, ok := firstVarint(service.taken()[0].message, 29); ok {
		t.Fatal("a picked environment is not deferred")
	}
}

// An environment id the account has no environment under is its own refusal,
// SESS_010, naming the id: not the service's bare words under SESS_009.
func TestCodexStartRefusesAnEnvironmentTheAccountDoesNotHave(t *testing.T) {
	_, codex := codexServer(t, func(string, []byte) ([]byte, int, string) {
		return nil, grpcNotFound, "environment config not found"
	})

	_, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "asenvcfg_gone")
	if code := codeOf(t, err); code != domain.ErrCodexCloudEnvironment.Code {
		t.Fatalf("code = %s, want SESS_010", code)
	}
	if detail := problem.From(err).Detail; !strings.Contains(detail, "asenvcfg_gone") || !strings.Contains(detail, "environment config not found") {
		t.Fatalf("detail = %q", detail)
	}
}

// A refusal of a start in a picked environment for any other reason than "not
// found" is the service's own words, not "not on this account".
func TestCodexStartSaysOtherRefusalsOfAPickedEnvironmentInCodexsWords(t *testing.T) {
	_, codex := codexServer(t, func(string, []byte) ([]byte, int, string) {
		return nil, 3, "repository overrides are required"
	})
	_, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "asenvcfg_web")
	if code := codeOf(t, err); code != domain.ErrCodexCloudStart.Code {
		t.Fatalf("code = %s, want SESS_009", code)
	}
}

// Codex cloud needs a ChatGPT sign-in. A host with none, with an API key, or
// with one past its expiry that `codex` cannot renew is refused before
// anything is sent, as SESS_022, which says to run `codex login`; and so is
// one ChatGPT refuses.
func TestCodexStartSaysTheHostIsNotSignedIn(t *testing.T) {
	service, codex := codexServer(t, starts)
	apiKey := t.TempDir()
	if err := os.WriteFile(filepath.Join(apiKey, "auth.json"), []byte(`{"OPENAI_API_KEY": "sk-x", "tokens": null}`), 0o600); err != nil {
		t.Fatal(err)
	}
	for name, home := range map[string]string{
		"none":    t.TempDir(),
		"api key": apiKey,
		"expired": signedIn(t, token(time.Now().Add(-time.Minute))),
	} {
		codex.Home = home
		_, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "")
		if code := codeOf(t, err); code != domain.ErrCodexCloudSignIn.Code {
			t.Errorf("%s: code = %s, want SESS_022", name, code)
		}
		if !strings.Contains(problem.From(err).Detail, "codex login") {
			t.Errorf("%s: detail = %q", name, problem.From(err).Detail)
		}
	}
	if calls := service.taken(); len(calls) != 0 {
		t.Fatalf("calls = %v, want none sent", calls)
	}

	_, refused := codexServer(t, func(string, []byte) ([]byte, int, string) {
		return nil, grpcUnauthenticated, "token revoked"
	})
	_, err := refused.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "")
	if code := codeOf(t, err); code != domain.ErrCodexCloudSignIn.Code {
		t.Fatalf("revoked: code = %s, want SESS_022", code)
	}
}

// renewingCodex writes a stand-in for the CLI that, run as `codex app-server`,
// answers `account/read` by writing a sign-in with access token next into
// $CODEX_HOME/auth.json, as Codex's own refresh does, and records that it ran.
func renewingCodex(t *testing.T, next string) (bin, ran string) {
	t.Helper()
	dir := t.TempDir()
	bin, ran = filepath.Join(dir, "codex"), filepath.Join(dir, "ran")
	auth := fmt.Sprintf(`{"tokens": {"access_token": %q, "account_id": "acc-%s"}}`, next, t.Name())
	script := "#!/bin/sh\n" +
		"[ \"$1\" = app-server ] || exit 2\n" +
		"while read -r line; do case \"$line\" in *account/read*refreshToken*)\n" +
		"  printf '%s' '" + auth + "' > \"$CODEX_HOME/auth.json\"; touch '" + ran + "'\n" +
		"  echo '{\"id\":1,\"result\":{\"account\":null}}' ;;\n" +
		"  *initialize\\\"*) echo '{\"id\":0,\"result\":{}}' ;; esac; done\n"
	if err := os.WriteFile(bin, []byte(script), 0o755); err != nil { //nolint:gosec // an executable stand-in
		t.Fatal(err)
	}
	return bin, ran
}

// A sign-in about to expire is renewed by the host's own `codex` before the
// call, and the call carries the renewed token: a host nobody types `codex`
// on keeps starting tasks.
func TestCodexRenewsASignInAboutToExpireThroughTheCLI(t *testing.T) {
	service, codex := codexServer(t, starts)
	fresh := token(time.Now().Add(8 * 24 * time.Hour))
	codex.Command, _ = renewingCodex(t, fresh)
	codex.Home = signedIn(t, token(time.Now().Add(time.Minute)))

	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", ""); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := service.taken()[0].header.Get("Authorization"); got != "Bearer "+fresh {
		t.Fatalf("Authorization = %q, want the renewed token", got)
	}
}

// A sign-in ChatGPT refuses is renewed once and the call sent again with it.
func TestCodexRenewsASignInChatGPTRefusedAndAsksAgain(t *testing.T) {
	fresh := token(time.Now().Add(8 * 24 * time.Hour))
	service, codex := codexServer(t, func(string, []byte) ([]byte, int, string) { return turns(1), 0, "" })
	service.answer = func(_ string, _ []byte) ([]byte, int, string) {
		if len(service.calls) == 1 {
			return nil, grpcUnauthenticated, "token revoked"
		}
		return turns(1), 0, ""
	}
	bin, ran := renewingCodex(t, fresh)
	codex.Command = bin

	got, err := codex.Status(context.Background(), "thr_1")
	if err != nil || got != CodexReady {
		t.Fatalf("Status = %q, %v", got, err)
	}
	if _, err := os.Stat(ran); err != nil {
		t.Fatal("codex was not asked to renew the sign-in")
	}
	calls := service.taken()
	if len(calls) != 2 || calls[1].header.Get("Authorization") != "Bearer "+fresh {
		t.Fatalf("calls = %d, second with %q", len(calls), calls[len(calls)-1].header.Get("Authorization"))
	}
}

// An answer lost on the way back leaves it unknown whether the task was
// admitted. It is sent once more with the same message id, which the service
// takes as the same message, rather than failing a task that may be running.
func TestCodexStartSendsTheTaskAgainUnderTheSameIdWhenTheAnswerIsLost(t *testing.T) {
	adds := 0
	service, codex := codexServer(t, starts)
	service.answer = func(method string, message []byte) ([]byte, int, string) {
		if method == "AddUserMessage" {
			adds++
		}
		return starts(method, message)
	}
	service.lose = func(method string) bool { return method == "AddUserMessage" && adds == 1 }

	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", ""); err != nil {
		t.Fatalf("Start: %v", err)
	}
	calls := service.taken()
	if len(calls) != 3 || string(firstBytes(calls[1].message, 4)) != string(firstBytes(calls[2].message, 4)) {
		t.Fatalf("calls = %d; the message was not sent again under its id", len(calls))
	}
}

// ChatGPT's "stop" pauses the account: the refusal is SESS_011, and nothing is
// sent for that account until the time it named has passed.
func TestCodexCloudStopsAskingWhenChatGPTSaysWait(t *testing.T) {
	service, codex := codexServer(t, func(string, []byte) ([]byte, int, string) {
		return nil, grpcResourceExhausted, "slow down"
	})
	now := time.Now()
	codex.Now = func() time.Time { return now }

	_, err := codex.Status(context.Background(), "thr_1")
	if code := codeOf(t, err); code != domain.ErrCodexRateLimited.Code {
		t.Fatalf("code = %s, want SESS_011", code)
	}
	_, err = codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "")
	if code := codeOf(t, err); code != domain.ErrCodexRateLimited.Code {
		t.Fatalf("paused start: code = %s, want SESS_011", code)
	}
	if calls := service.taken(); len(calls) != 1 {
		t.Fatalf("calls = %d, want only the one refused", len(calls))
	}

	now = now.Add(2 * time.Minute)
	if _, err := codex.Status(context.Background(), "thr_1"); codeOf(t, err) != domain.ErrCodexRateLimited.Code {
		t.Fatalf("after the pause: %v", err)
	}
	if calls := service.taken(); len(calls) != 2 {
		t.Fatalf("calls = %d, want the account asked again once the pause passed", len(calls))
	}
}

// Any other refusal is the service's own words, under SESS_009.
func TestCodexStartSaysWhyCodexCloudRefused(t *testing.T) {
	_, codex := codexServer(t, func(string, []byte) ([]byte, int, string) {
		return nil, 13, "GitHub is not connected for this workspace"
	})
	_, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "")
	if code := codeOf(t, err); code != domain.ErrCodexCloudStart.Code {
		t.Fatalf("code = %s, want SESS_009", code)
	}
	if !strings.Contains(problem.From(err).Detail, "GitHub is not connected") {
		t.Fatalf("detail = %q", problem.From(err).Detail)
	}
}

// A thread's status is its newest turn's: running or not begun is pending,
// completed is ready, failed or stopped is an error. The ask names the thread
// and wants one turn, newest first.
func TestCodexStatusIsTheNewestTurns(t *testing.T) {
	for name, tc := range map[string]struct {
		reply []byte
		want  string
	}{
		"no turn yet": {turns(), CodexPending},
		"running":     {turns(4), CodexPending},
		"completed":   {turns(1, 3), CodexReady},
		"failed":      {turns(3), CodexError},
		"interrupted": {turns(2), CodexError},
	} {
		t.Run(name, func(t *testing.T) {
			service, codex := codexServer(t, func(string, []byte) ([]byte, int, string) { return tc.reply, 0, "" })
			got, err := codex.Status(context.Background(), "thr_1")
			if err != nil || got != tc.want {
				t.Fatalf("Status = %q, %v; want %q", got, err, tc.want)
			}
			ask := service.taken()[0]
			limit, _ := firstVarint(ask.message, 3)
			order, _ := firstVarint(ask.message, 4)
			if ask.method != "ListTurns" || string(firstBytes(ask.message, 1)) != "thr_1" || limit != 1 || order != 2 {
				t.Fatalf("ask = %s %q limit %d order %d", ask.method, firstBytes(ask.message, 1), limit, order)
			}
		})
	}
}

func TestCodexSettledIsFinishedOrFailed(t *testing.T) {
	for status, want := range map[string]bool{
		CodexPending: false, CodexReady: true, CodexApplied: true, CodexError: true, "": false,
	} {
		if got := CodexSettled(status); got != want {
			t.Errorf("CodexSettled(%q) = %v, want %v", status, got, want)
		}
	}
}
