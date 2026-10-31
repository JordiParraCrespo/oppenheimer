package cloud

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// signedIn writes a ChatGPT sign-in as `codex login` keeps it, and answers
// the Codex home that holds it.
func signedIn(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	auth := `{"OPENAI_API_KEY": null, "tokens": {"id_token": "x", "access_token": "tok-1", "refresh_token": "r", "account_id": "acc-1"}}`
	if err := os.WriteFile(filepath.Join(home, "auth.json"), []byte(auth), 0o600); err != nil {
		t.Fatal(err)
	}
	return home
}

// chatGPT is the backend the CLI reads environments from: by-repo answers
// for one repository, and the account's list.
func chatGPT(t *testing.T, byRepo, all string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok-1" || r.Header.Get("ChatGPT-Account-Id") != "acc-1" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/wham/environments/by-repo/github/acme-labs/xrp-mobile":
			_, _ = w.Write([]byte(byRepo))
		case "/wham/environments":
			_, _ = w.Write([]byte(all))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

// The account's environments, those linked to the repository marked and
// first; among several linked ones the pinned one is what a task starts in,
// as Codex's own picker chooses.
func TestCodexEnvironmentsMarksAndRecommendsTheRepositorysOwn(t *testing.T) {
	server := chatGPT(t,
		`[{"id": "e_web", "label": "Wallet web", "task_count": 40}, {"id": "e_app", "label": "Wallet app", "is_pinned": true, "task_count": 2}]`,
		`[{"id": "e_app", "label": "Wallet app"}, {"id": "e_docs", "label": "docs"}, {"id": "e_web", "label": "Wallet web"}, {"id": "e_api", "label": "API"}]`)
	codex := Codex{Home: signedIn(t), BaseURL: server.URL}

	envs, err := codex.Environments(context.Background(), "acme-labs/xrp-mobile")
	if err != nil {
		t.Fatalf("Environments: %v", err)
	}
	if envs.Source != CodexSourceChatGPT || envs.Recommended != "e_app" {
		t.Fatalf("source %q, recommended %q", envs.Source, envs.Recommended)
	}
	var order []string
	for _, env := range envs.Environments {
		order = append(order, env.ID)
	}
	if strings.Join(order, ",") != "e_app,e_web,e_api,e_docs" {
		t.Fatalf("order = %v, want linked (pinned first), then the rest by label", order)
	}
	if !envs.Environments[1].Repository || envs.Environments[2].Repository {
		t.Fatalf("environments = %+v", envs.Environments)
	}
}

// With no environment linked, nothing is recommended: a start falls back to
// the repository's names.
func TestCodexEnvironmentsRecommendsNothingWhenNoneIsLinked(t *testing.T) {
	server := chatGPT(t, `[]`, `[{"id": "e_docs", "label": "docs"}]`)
	envs, err := Codex{Home: signedIn(t), BaseURL: server.URL}.Environments(context.Background(), "acme-labs/xrp-mobile")
	if err != nil {
		t.Fatalf("Environments: %v", err)
	}
	if envs.Recommended != "" || len(envs.Environments) != 1 {
		t.Fatalf("envs = %+v", envs)
	}
}

// A host whose CLI keeps no sign-in on disk lists the environments its recent
// tasks ran in instead.
func TestCodexEnvironmentsFallsBackToTheTasksEnvironments(t *testing.T) {
	bin, _ := fakeCodex(t, `exit 1`)
	withTasks(t, bin, `{"tasks": [
  {"id": "task_e_2", "status": "ready", "environment_id": "e_app", "environment_label": "Wallet app"},
  {"id": "task_e_1", "status": "ready", "environment_id": "e_app", "environment_label": "Wallet app"},
  {"id": "task_e_0", "status": "error", "environment_id": "e_api"}
]}`)
	envs, err := Codex{Command: bin, Home: t.TempDir()}.Environments(context.Background(), "acme-labs/xrp-mobile")
	if err != nil {
		t.Fatalf("Environments: %v", err)
	}
	if envs.Source != CodexSourceTasks || envs.Recommended != "" || len(envs.Environments) != 2 ||
		envs.Environments[0].ID != "e_api" || envs.Environments[1].Label != "Wallet app" {
		t.Fatalf("envs = %+v", envs)
	}
}

// A start with nothing picked goes to the environment linked to the
// repository, by id, whatever it is labelled.
func TestCodexStartUsesTheEnvironmentLinkedToTheRepository(t *testing.T) {
	server := chatGPT(t, `[{"id": "e_app", "label": "Wallet app"}]`, `[]`)
	bin, args := fakeCodex(t, `echo 'https://chatgpt.com/codex/tasks/task_e_9'`)
	codex := Codex{Command: bin, Home: signedIn(t), BaseURL: server.URL}

	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", ""); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := strings.Join(readArgs(t, args), " "); got != "cloud exec --env=e_app --branch main task" {
		t.Fatalf("args = %q", got)
	}
}

// A picked environment is used as it is, once, with nothing listed.
func TestCodexStartUsesThePickedEnvironment(t *testing.T) {
	bin, args := fakeCodex(t, `echo 'https://chatgpt.com/codex/tasks/task_e_9'`)
	if _, err := (Codex{Command: bin}).Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", "-weird label"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := readArgs(t, args); len(got) != 6 || got[2] != "--env=-weird label" {
		t.Fatalf("args = %q", got)
	}
}

// When the account's whole list was read and no environment in it is linked
// to or named for the repository, the start is SESS_010 naming every
// environment the CLI can reach, and the CLI is not asked to guess.
func TestCodexStartNamesTheAccountsEnvironmentsWhenNoneFits(t *testing.T) {
	server := chatGPT(t, `[]`, `[{"id": "e_docs", "label": "docs"}, {"id": "e_api"}]`)
	bin, args := fakeCodex(t, `echo 'https://chatgpt.com/codex/tasks/task_e_9'`)
	_, err := Codex{Command: bin, Home: signedIn(t), BaseURL: server.URL}.Start(
		context.Background(), "acme-labs/xrp-mobile", "main", "task", "")

	pe := problem.From(err)
	if pe == nil || pe.Code != domain.ErrCodexCloudEnvironment.Code {
		t.Fatalf("err = %v, want ErrCodexCloudEnvironment", err)
	}
	if !strings.Contains(pe.Detail, "labelled acme-labs/xrp-mobile or xrp-mobile") ||
		!strings.Contains(pe.Detail, "Environments the CLI can reach: e_api, docs.") {
		t.Fatalf("detail = %q", pe.Detail)
	}
	if _, statErr := os.Stat(args); statErr == nil {
		t.Fatalf("the CLI was run: %q", readArgs(t, args))
	}
}

// A 429 from ChatGPT is its "stop": the refusal is SESS_011, nothing else is
// asked in its place (not the account's list, not `codex cloud list`), and the
// account is not asked again until the Retry-After it named has passed.
func TestCodexEnvironmentsStopsAtARateLimitUntilItsRetryAfter(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	t.Cleanup(server.Close)
	bin, args := fakeCodex(t, `echo '{"tasks": []}'`)
	now := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	home := signedIn(t)
	// Another test's account: the pause is per ChatGPT account.
	auth := `{"tokens": {"access_token": "tok-1", "account_id": "acc-rate"}}`
	if err := os.WriteFile(filepath.Join(home, "auth.json"), []byte(auth), 0o600); err != nil {
		t.Fatal(err)
	}
	codex := Codex{Command: bin, Home: home, BaseURL: server.URL, Now: func() time.Time { return now }}

	_, err := codex.Environments(context.Background(), "acme-labs/xrp-mobile")
	if pe := problem.From(err); pe == nil || pe.Code != domain.ErrCodexRateLimited.Code {
		t.Fatalf("err = %v, want ErrCodexRateLimited", err)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want the refused one alone", requests)
	}
	if _, statErr := os.Stat(args); statErr == nil {
		t.Fatalf("codex cloud list ran after a rate limit: %q", readArgs(t, args))
	}

	now = now.Add(20 * time.Second)
	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", ""); problem.From(err) == nil ||
		problem.From(err).Code != domain.ErrCodexRateLimited.Code {
		t.Fatalf("Start during the pause = %v, want ErrCodexRateLimited", err)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want none during the pause", requests)
	}

	now = now.Add(11 * time.Second)
	_, _ = codex.Environments(context.Background(), "acme-labs/xrp-mobile")
	if requests != 2 {
		t.Fatalf("requests = %d, want ChatGPT asked again once the pause passed", requests)
	}
}

// With none linked, an environment labelled with the repository's name (any
// case, full name first) is the pick, by id: the CLI is not asked to guess.
func TestCodexStartUsesTheEnvironmentLabelledWithTheRepositorysName(t *testing.T) {
	server := chatGPT(t, `[]`, `[{"id": "e_docs", "label": "docs"}, {"id": "e_app", "label": "XRP-Mobile"}]`)
	bin, args := fakeCodex(t, `echo 'https://chatgpt.com/codex/tasks/task_e_9'`)
	codex := Codex{Command: bin, Home: signedIn(t), BaseURL: server.URL}

	envs, err := codex.Environments(context.Background(), "acme-labs/xrp-mobile")
	if err != nil || envs.Recommended != "e_app" {
		t.Fatalf("recommended = %q, err = %v", envs.Recommended, err)
	}
	if _, err := codex.Start(context.Background(), "acme-labs/xrp-mobile", "main", "task", ""); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := strings.Join(readArgs(t, args), " "); got != "cloud exec --env=e_app --branch main task" {
		t.Fatalf("args = %q", got)
	}
}
