package cloud

// Codex cloud, driven by the person's own `codex` CLI and its ChatGPT
// sign-in, the only supported driver of their account (OpenAI publishes no
// API for cloud tasks; product/research/cloud-agents.md §3):
//
//	codex cloud exec --env <env> --branch <branch> <task>
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
// (`/wham/environments`). ChatGPT's newer Settings → Codex Cloud keeps its
// environments elsewhere, and codex-cli (0.166.0) cannot reach them, so a
// repository whose only environment is there fails as "not found" however it
// is named. The CLI has no command that lists environments outside the TUI;
// the labels on the account's recent tasks are the one non-interactive view
// of them, partial by construction.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	// EnvironmentLabel is the label of the environment the task ran in, as
	// the CLI names it; empty when it gave none.
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
}

// codexTaskURL is where `codex cloud exec` says the task went:
// `https://chatgpt.com/codex/tasks/task_…`, on whichever ChatGPT base the
// CLI is configured for.
var codexTaskURL = regexp.MustCompile(`https?://\S+/codex/tasks/([A-Za-z0-9_-]+)`)

// Start creates a task for prompt in the Codex cloud environment of
// repository (`owner/name`) on branch, and answers it once the CLI has named
// it. The environment is named by its label, which `codex cloud exec`
// matches without regard to case: the repository's full name first, then its
// bare name, the two ways people name one. When the CLI has neither, the
// start is ErrCodexCloudEnvironment, naming the labels tried and the ones the
// CLI can see; any other refusal is the CLI's own, in its words.
func (c Codex) Start(ctx context.Context, repository, branch, prompt string) (Started, error) {
	tried := codexEnvironments(repository)
	for _, env := range tried {
		out, err := c.run(ctx, "cloud", "exec", "--env", env, "--branch", branch, prompt)
		if err == nil {
			if match := codexTaskURL.FindStringSubmatch(out); match != nil {
				return Started{ID: match[1], URL: match[0]}, nil
			}
			return Started{}, domain.ErrCodexCloudStart.WithDetail(
				"codex cloud exec named no task: %s", lastWords(out))
		}
		if !codexEnvironmentMissing(err) {
			return Started{}, err
		}
	}
	return Started{}, c.noEnvironment(ctx, tried)
}

// codexEnvironmentMissing reports whether the CLI refused because it has no
// environment under the label: "environment '<label>' not found; run `codex
// cloud` to list available environments".
func codexEnvironmentMissing(err error) bool {
	return strings.Contains(err.Error(), "not found")
}

// codexVisibleMax bounds how many labels a refusal names.
const codexVisibleMax = 8

// noEnvironment is the refusal for a repository the CLI has no environment
// for. What it can see is read off one page of the account's newest tasks: a
// read that fails says so instead of naming any, and the start fails the same.
func (c Codex) noEnvironment(ctx context.Context, tried []string) error {
	visible := "could not be read"
	if page, err := c.List(ctx, ""); err == nil {
		visible = "none"
		if labels := codexLabels(page.Tasks, tried); len(labels) > 0 {
			visible = strings.Join(labels, ", ")
		}
	}
	return domain.ErrCodexCloudEnvironment.WithDetail(
		"codex cloud exec found no environment labelled %s. Environments made in ChatGPT Settings → Codex Cloud are not reachable by the CLI yet. Environments in this account's recent tasks: %s (partial: codex-cli lists its environments only in its TUI, `codex cloud`).",
		strings.Join(tried, " or "), visible)
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
