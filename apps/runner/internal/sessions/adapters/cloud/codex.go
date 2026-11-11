package cloud

// Codex cloud, driven by the person's own `codex` CLI and its ChatGPT
// sign-in, the only supported driver of their account (OpenAI publishes no
// API for cloud tasks; product/research/cloud-agents.md §3):
//
//	codex cloud exec --env=<env> --branch <branch> <task>
//
// prints the new task's address and exits, and
//
//	codex cloud list --json --limit 20 [--cursor <c>]
//
// answers the newest tasks of the account with their status. Both are
// labelled experimental in OpenAI's source (codex-rs/cloud-tasks), so what is
// read from them is kept to the task's address, id, status and the label of
// its environment.
//
// `--env` resolves only against the environments the CLI's TUI lists
// (`/wham/environments`), which ChatGPT now calls Codex Cloud (Legacy).
// ChatGPT's Settings → Codex Cloud keeps its environments in another service,
// and the CLI has no command that starts a task in one (read again in
// openai/codex on 2026-11-11: product/research/cloud-agents.md §7), so a
// repository whose only environment is there fails as "not found" however it
// is named, and an account with none of the older kind as "no cloud
// environments are available". The CLI has no command that lists environments
// outside the TUI; the labels on the account's recent tasks are the one
// non-interactive view of them, partial by construction.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The statuses `codex cloud list --json` gives a task.
const (
	// CodexPending is a task queued or running: the CLI does not tell the two apart.
	CodexPending = "pending"
	// CodexReady is a finished task whose diff is ready to apply.
	CodexReady = "ready"
	// CodexApplied is a finished task whose diff was applied somewhere.
	CodexApplied = "applied"
	// CodexError is a task that failed or was cancelled.
	CodexError = "error"
)

// CodexSettled reports whether a task's status will not change again on its
// own: finished or failed.
func CodexSettled(status string) bool {
	return status == CodexReady || status == CodexApplied || status == CodexError
}

// CodexTask is one task as `codex cloud list --json` describes it.
type CodexTask struct {
	ID     string `json:"id"`
	URL    string `json:"url"`
	Title  string `json:"title"`
	Status string `json:"status"`
	// EnvironmentID and EnvironmentLabel name the environment the task ran
	// in, as the CLI names it; the label is empty when it gave none.
	EnvironmentID    string `json:"environment_id"`
	EnvironmentLabel string `json:"environment_label"`
}

// CodexPage is one answer of `codex cloud list --json`: the tasks, newest
// first, and the cursor of the next page, empty on the last.
type CodexPage struct {
	Tasks  []CodexTask `json:"tasks"`
	Cursor string      `json:"cursor"`
}

// Codex runs the `codex` CLI's cloud commands. The zero value runs `codex`
// from PATH with a two-minute limit.
type Codex struct {
	// Command is the CLI to run; empty is "codex".
	Command string
	// Timeout bounds one command; zero is two minutes.
	Timeout time.Duration
	// Home is the CLI's home, where its sign-in is; empty is where the CLI
	// looks itself ($CODEX_HOME, else ~/.codex).
	Home string
	// BaseURL is the ChatGPT backend environments are read from; empty is
	// chatgpt.com's.
	BaseURL string
	// HTTP reads them; nil is http.DefaultClient.
	HTTP *http.Client
	// Now is the clock a rate-limit pause is read against; nil is time.Now.
	Now func() time.Time
}

// codexTaskURL is where `codex cloud exec` says the task went:
// `https://chatgpt.com/codex/tasks/task_…`, on whichever ChatGPT base the
// CLI is configured for.
var codexTaskURL = regexp.MustCompile(`https?://\S+/codex/tasks/([A-Za-z0-9_-]+)`)

// Start creates a task for prompt in a Codex cloud environment for
// repository (`owner/name`) on branch, and answers it once the CLI has named
// it. environment is the one the person picked, by id or label; empty, it is
// the account's pick for the repository (Environments' Recommended: the one
// linked to it, else one labelled with its name). With none, the start is a
// domain.CodexEnvironmentRefusal naming every environment the CLI can reach.
// Only when the account's whole list could not be read (none, or only its
// tasks' environments) are the repository's names handed to the CLI as
// labels, and its refusal of both is that refusal with what the tasks show.
// A picked environment the CLI no longer has (deleted, or moved to ChatGPT's
// newer Codex Cloud since the pick) is that refusal too. A CLI with no ChatGPT
// sign-in is domain.ErrCodexCloudSignIn; any other refusal is the CLI's own,
// in its words.
func (c Codex) Start(ctx context.Context, repository, branch, prompt, environment string) (Started, error) {
	if environment != "" {
		started, err := c.exec(ctx, environment, branch, prompt)
		if err != nil && codexEnvironmentMissing(err, environment) {
			return Started{}, c.environmentRefusal(ctx, []string{environment}).Problem()
		}
		return started, err
	}
	envs, listErr := c.Environments(ctx, repository)
	switch {
	// The CLI resolves a label by reading the same environments with the same
	// sign-in, so a refusal for rate or for no sign-in is not worked around by
	// asking it instead.
	case isRateLimited(listErr), isSignedOut(listErr):
		return Started{}, listErr
	case listErr == nil && envs.Recommended != "":
		return c.exec(ctx, envs.Recommended, branch, prompt)
	case listErr == nil && envs.Source == CodexSourceChatGPT:
		return Started{}, unreachable(repository, envs).Problem()
	}
	tried := codexEnvironments(repository)
	for _, env := range tried {
		started, err := c.exec(ctx, env, branch, prompt)
		if err == nil {
			return started, nil
		}
		if !codexEnvironmentMissing(err, env) {
			return Started{}, err
		}
	}
	return Started{}, c.environmentRefusal(ctx, tried).Problem()
}

// exec runs `codex cloud exec` in env. The value rides `--env=`, so one that
// starts with a dash is still the value and not a flag.
func (c Codex) exec(ctx context.Context, env, branch, prompt string) (Started, error) {
	out, err := c.run(ctx, "cloud", "exec", "--env="+env, "--branch", branch, prompt)
	if err != nil {
		return Started{}, err
	}
	if match := codexTaskURL.FindStringSubmatch(out); match != nil {
		return Started{ID: match[1], URL: match[0]}, nil
	}
	return Started{}, domain.ErrCodexCloudStart.WithDetail(
		"codex cloud exec named no task: %s", lastWords(out))
}

// unreachable is the refusal when the account's whole list was read and no
// environment in it is linked to or named for the repository: the labels
// tried and every environment the CLI can reach.
func unreachable(repository string, envs CodexEnvironments) domain.CodexEnvironmentRefusal {
	refusal := domain.CodexEnvironmentRefusal{Tried: codexEnvironments(repository), Listed: true, Complete: true}
	for _, env := range envs.Environments {
		name := env.Label
		if name == "" {
			name = env.ID
		}
		refusal.Visible = append(refusal.Visible, name)
		if len(refusal.Visible) == codexVisibleMax {
			break
		}
	}
	return refusal
}

// codexMissing is the CLI's refusal of a label it has no environment for
// (codex-rs/cloud-tasks/src/lib.rs, resolve_environment_id): "environment
// '<label>' not found; run `codex cloud` to list available environments".
var codexMissing = regexp.MustCompile(`environment '([^']*)' not found`)

// codexNoEnvironments is the same function's refusal for an account whose
// list is empty, which is every account that has only ChatGPT's newer
// environments.
const codexNoEnvironments = "no cloud environments are available"

// codexSignedOut is the CLI saying it holds no ChatGPT sign-in, in the
// wording seen, pinned like the Claude adapter's signedOut: a release that
// rewords it only loses the code of its own, and the refusal reads as
// SESS_009 in its own words. "Not signed in. Please run 'codex login' to sign
// in with ChatGPT, then re-run 'codex cloud'." (codex-rs/cloud-tasks/src/lib.rs).
var codexSignedOut = regexp.MustCompile(`(?i)not (signed|logged) in|run 'codex login'`)

// codexEnvironmentMissing reports whether err is the CLI refusing env itself
// as missing, or having no environment at all, and not some other refusal
// that happens to say "not found".
func codexEnvironmentMissing(err error, env string) bool {
	text := err.Error()
	if strings.Contains(text, codexNoEnvironments) {
		return true
	}
	match := codexMissing.FindStringSubmatch(text)
	return match != nil && match[1] == env
}

// codexVisibleMax bounds how many labels a refusal names.
const codexVisibleMax = 8

// environmentRefusal is what the CLI can see when it has nothing under the
// labels tried, read off one page of the account's newest tasks; a read that
// fails leaves the refusal unlisted rather than failing differently.
func (c Codex) environmentRefusal(ctx context.Context, tried []string) domain.CodexEnvironmentRefusal {
	refusal := domain.CodexEnvironmentRefusal{Tried: tried}
	if page, err := c.List(ctx, ""); err == nil {
		refusal.Listed = true
		refusal.Visible = codexLabels(page.Tasks, tried)
	}
	return refusal
}

// codexLabels is the environment labels tasks ran in, each once, in the order
// first seen, leaving out the labels the CLI just refused, at most
// codexVisibleMax of them.
func codexLabels(tasks []CodexTask, refused []string) []string {
	seen := make(map[string]bool, len(tasks)+len(refused))
	for _, label := range refused {
		seen[strings.ToLower(label)] = true
	}
	var labels []string
	for _, task := range tasks {
		key := strings.ToLower(task.EnvironmentLabel)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		labels = append(labels, task.EnvironmentLabel)
		if len(labels) == codexVisibleMax {
			break
		}
	}
	return labels
}

// List answers one page of the account's tasks, newest first; cursor is the
// previous page's, or empty for the first.
func (c Codex) List(ctx context.Context, cursor string) (CodexPage, error) {
	args := []string{"cloud", "list", "--json", "--limit", strconv.Itoa(20)}
	if cursor != "" {
		args = append(args, "--cursor", cursor)
	}
	out, err := c.run(ctx, args...)
	if err != nil {
		return CodexPage{}, err
	}
	var page CodexPage
	if err := json.Unmarshal([]byte(out), &page); err != nil {
		return CodexPage{}, domain.ErrCodexCloudStart.WithDetail(
			"codex cloud list answered no JSON: %s", lastWords(out)).WithCause(err)
	}
	return page, nil
}

// run runs the CLI with no input and answers what it printed; a non-zero exit
// is ErrCodexCloudStart with the CLI's own last words, or ErrCodexCloudSignIn
// when those words are that it is not signed in.
func (c Codex) run(ctx context.Context, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	cmd := exec.CommandContext(ctx, c.command(), args...) //nolint:gosec // the CLI by name, each value one argument: no shell reads them
	cmd.Env = os.Environ()
	cmd.WaitDelay = 5 * time.Second
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err == nil {
		return stdout.String(), nil
	}
	detail := lastWords(stderr.String() + "\n" + stdout.String())
	if ctx.Err() != nil {
		return "", domain.ErrCodexCloudStart.WithDetail(
			"%s %s did not answer within %s: %s", c.command(), args[1], c.timeout(), detail).WithCause(ctx.Err())
	}
	if detail == "" {
		detail = err.Error()
	}
	problemErr := domain.ErrCodexCloudStart.WithDetail("%s", detail)
	if codexSignedOut.MatchString(detail) {
		problemErr = domain.ErrCodexCloudSignIn.WithDetail("%s", detail)
	}
	var exit *exec.ExitError
	if !errors.As(err, &exit) {
		return "", problemErr.WithCause(err)
	}
	return "", problemErr
}

// codexEnvironments is the labels an environment for repository is tried
// under, in order.
func codexEnvironments(repository string) []string {
	envs := []string{repository}
	if _, name, ok := strings.Cut(repository, "/"); ok && name != "" {
		envs = append(envs, name)
	}
	return envs
}

func (c Codex) command() string {
	if c.Command == "" {
		return "codex"
	}
	return c.Command
}

func (c Codex) timeout() time.Duration {
	if c.Timeout <= 0 {
		return 2 * time.Minute
	}
	return c.Timeout
}
