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
// read from them is kept to the task's address, id and status.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	// EnvironmentID and EnvironmentLabel name the environment it ran in.
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
// linked to it, else one labelled with its name). With none, the refusal says
// what to do and names the account's environments. Only when the account's
// whole list could not be read (none, or only its tasks' environments) are
// the repository's names handed to the CLI as labels.
func (c Codex) Start(ctx context.Context, repository, branch, prompt, environment string) (Started, error) {
	if environment != "" {
		return c.exec(ctx, environment, branch, prompt)
	}
	envs, listErr := c.Environments(ctx, repository)
	switch {
	// The CLI resolves a label by reading the same environments, so a refusal
	// for rate is not worked around by asking it instead.
	case isRateLimited(listErr):
		return Started{}, listErr
	case listErr == nil && envs.Recommended != "":
		return c.exec(ctx, envs.Recommended, branch, prompt)
	case listErr == nil && envs.Source == CodexSourceChatGPT:
		return Started{}, noEnvironment(repository, envs, nil)
	}
	var refusal error
	for _, env := range codexEnvironments(repository) {
		started, err := c.exec(ctx, env, branch, prompt)
		if err == nil {
			return started, nil
		}
		refusal = err
		if !strings.Contains(err.Error(), "not found") {
			return Started{}, err
		}
	}
	return Started{}, noEnvironment(repository, envs, refusal)
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

// noEnvironment is the refusal for a repository no environment was found
// for: what to do about it, and the environments the account has, by label.
func noEnvironment(repository string, envs CodexEnvironments, refusal error) error {
	var names []string
	for _, env := range envs.Environments {
		name := env.Label
		if name == "" {
			name = env.ID
		}
		names = append(names, name)
		if len(names) == 8 {
			break
		}
	}
	detail := fmt.Sprintf("No Codex environment is linked to %s, and none is labelled with its name. "+
		"Pick one when you start the session, or add the repository to an environment on chatgpt.com/codex.", repository)
	switch {
	case len(names) > 0:
		detail += " This account has: " + strings.Join(names, ", ") + "."
	case refusal == nil:
		detail += " This account has no environments yet."
	}
	return domain.ErrCodexCloudStart.WithDetail("%s", detail).WithCause(refusal)
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
// is ErrCodexCloudStart with the CLI's own last words.
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
