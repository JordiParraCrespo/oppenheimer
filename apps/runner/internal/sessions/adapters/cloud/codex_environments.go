package cloud

// Codex cloud environments. `codex cloud exec --env` takes an environment's
// id or its label, and the CLI has no command that lists them: its TUI reads
// them from the ChatGPT backend it starts tasks on,
//
//	GET {base}/wham/environments/by-repo/github/{owner}/{name}
//	GET {base}/wham/environments
//
// with the sign-in `codex login` keeps in $CODEX_HOME/auth.json
// (codex-rs/cloud-tasks/src/env_detect.rs). The host reads them the same way,
// with the same sign-in, so the composer can offer them and a task starts in
// the environment linked to its repository rather than one guessed from the
// repository's name. These endpoints are not published: when they cannot be
// read (no auth file, a key-ring sign-in, an answer of another shape), the
// environments the account's recent tasks ran in are the list instead, read
// off `codex cloud list --json`.
//
// The budget. OpenAI publishes no limit for these reads either. One list is
// at most two GETs, asked when someone opens the composer's picker or starts
// a Codex cloud session without picking, never on a timer.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// The places a list of Codex environments came from.
const (
	// CodexSourceChatGPT is the account's environments as chatgpt.com lists them.
	CodexSourceChatGPT = "chatgpt"
	// CodexSourceTasks is only the environments the account's recent tasks ran in.
	CodexSourceTasks = "tasks"
)

// codexDefaultBase is the ChatGPT backend the CLI talks to unless its config
// names another.
const codexDefaultBase = "https://chatgpt.com/backend-api"

// codexEnvironmentsMax bounds a list, as the wire does.
const codexEnvironmentsMax = 100

// CodexEnvironment is one Codex cloud environment.
type CodexEnvironment struct {
	ID    string
	Label string
	// Pinned is pinned on chatgpt.com/codex.
	Pinned bool
	// Repository is linked to the repository the list was asked for.
	Repository bool
	// Tasks is how many tasks ran in it, when ChatGPT says.
	Tasks int64
}

// CodexEnvironments is the account's environments, those linked to the
// repository first, then pinned, then by label.
type CodexEnvironments struct {
	Environments []CodexEnvironment
	// Recommended is the id a task for the repository starts in when none is
	// picked; empty when no environment is linked to it.
	Recommended string
	// Source is CodexSourceChatGPT or CodexSourceTasks.
	Source string
}

// codexEnvironmentRow is one environment as the ChatGPT backend answers it.
type codexEnvironmentRow struct {
	ID        string  `json:"id"`
	Label     *string `json:"label"`
	IsPinned  *bool   `json:"is_pinned"`
	TaskCount *int64  `json:"task_count"`
}

// codexAuth is the part of $CODEX_HOME/auth.json a ChatGPT request needs.
type codexAuth struct {
	Tokens *struct {
		AccessToken string `json:"access_token"`
		AccountID   string `json:"account_id"`
	} `json:"tokens"`
}

// errNoChatGPTSignIn is a host whose CLI keeps no ChatGPT sign-in on disk.
var errNoChatGPTSignIn = errors.New("no ChatGPT sign-in in the Codex auth file")

// Environments answers the environments the host's ChatGPT account can start
// a task in, marking those linked to repository (`owner/name`), with the one
// a task for it starts in when none is picked.
func (c Codex) Environments(ctx context.Context, repository string) (CodexEnvironments, error) {
	envs, err := c.chatGPTEnvironments(ctx, repository)
	if err == nil {
		return envs, nil
	}
	fromTasks, taskErr := c.taskEnvironments(ctx)
	if taskErr != nil {
		return CodexEnvironments{}, domain.ErrCodexCloudStart.WithDetail(
			"Codex could not list its environments: %v; and from its tasks: %s", err, problemDetail(taskErr)).WithCause(taskErr)
	}
	return fromTasks, nil
}

// chatGPTEnvironments asks the ChatGPT backend, as the CLI's own picker does.
func (c Codex) chatGPTEnvironments(ctx context.Context, repository string) (CodexEnvironments, error) {
	auth, err := c.readAuth()
	if err != nil {
		return CodexEnvironments{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, c.httpTimeout())
	defer cancel()

	byID := map[string]*CodexEnvironment{}
	var linked []codexEnvironmentRow
	if owner, name, ok := strings.Cut(repository, "/"); ok && owner != "" && name != "" {
		path := "/wham/environments/by-repo/github/" + url.PathEscape(owner) + "/" + url.PathEscape(name)
		// A repository with no environment, or a failed ask, still has the
		// account's list to fall back on.
		if rows, err := c.getEnvironments(ctx, auth, path); err == nil {
			linked = rows
			for _, row := range rows {
				env := merge(byID, row)
				env.Repository = true
			}
		}
	}
	all, err := c.getEnvironments(ctx, auth, "/wham/environments")
	if err != nil && len(byID) == 0 {
		return CodexEnvironments{}, err
	}
	for _, row := range all {
		merge(byID, row)
	}

	out := CodexEnvironments{Source: CodexSourceChatGPT, Recommended: recommend(linked)}
	for _, env := range byID {
		out.Environments = append(out.Environments, *env)
	}
	out.Environments = sortEnvironments(out.Environments)
	return out, nil
}

// merge adds row to byID, or folds it into the environment already there.
func merge(byID map[string]*CodexEnvironment, row codexEnvironmentRow) *CodexEnvironment {
	env, ok := byID[row.ID]
	if !ok {
		env = &CodexEnvironment{ID: row.ID}
		byID[row.ID] = env
	}
	if env.Label == "" && row.Label != nil {
		env.Label = strings.TrimSpace(*row.Label)
	}
	if row.IsPinned != nil && *row.IsPinned {
		env.Pinned = true
	}
	if row.TaskCount != nil && *row.TaskCount > env.Tasks {
		env.Tasks = *row.TaskCount
	}
	return env
}

// recommend is the environment Codex itself picks among those linked to a
// repository: the only one, else the pinned one, else the one with the most
// tasks (codex-rs/cloud-tasks/src/env_detect.rs, pick_environment_row).
func recommend(linked []codexEnvironmentRow) string {
	switch {
	case len(linked) == 0:
		return ""
	case len(linked) == 1:
		return linked[0].ID
	}
	for _, row := range linked {
		if row.IsPinned != nil && *row.IsPinned {
			return row.ID
		}
	}
	best := linked[0]
	for _, row := range linked[1:] {
		if count(row) > count(best) {
			best = row
		}
	}
	return best.ID
}

func count(row codexEnvironmentRow) int64 {
	if row.TaskCount == nil {
		return 0
	}
	return *row.TaskCount
}

// sortEnvironments orders a list as the picker shows it: linked to the
// repository, then pinned, then by label without regard to case, then by id;
// and keeps the first codexEnvironmentsMax.
func sortEnvironments(envs []CodexEnvironment) []CodexEnvironment {
	sort.SliceStable(envs, func(i, j int) bool {
		a, b := envs[i], envs[j]
		if a.Repository != b.Repository {
			return a.Repository
		}
		if a.Pinned != b.Pinned {
			return a.Pinned
		}
		if al, bl := strings.ToLower(a.Label), strings.ToLower(b.Label); al != bl {
			return al < bl
		}
		return a.ID < b.ID
	})
	if len(envs) > codexEnvironmentsMax {
		envs = envs[:codexEnvironmentsMax]
	}
	return envs
}

// getEnvironments GETs one list of environments off the ChatGPT backend.
func (c Codex) getEnvironments(ctx context.Context, auth codexAuth, path string) ([]codexEnvironmentRow, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base()+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+auth.Tokens.AccessToken)
	if auth.Tokens.AccountID != "" {
		req.Header.Set("ChatGPT-Account-Id", auth.Tokens.AccountID)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oppenheimer-runner")
	res, err := c.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = res.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ChatGPT answered %s for its environments", res.Status)
	}
	var rows []codexEnvironmentRow
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("ChatGPT's environments are not a list: %w", err)
	}
	kept := rows[:0]
	for _, row := range rows {
		if strings.TrimSpace(row.ID) != "" {
			kept = append(kept, row)
		}
	}
	return kept, nil
}

// taskEnvironments is the environments the account's newest tasks ran in,
// read off `codex cloud list --json`, which names each task's.
func (c Codex) taskEnvironments(ctx context.Context) (CodexEnvironments, error) {
	page, err := c.List(ctx, "")
	if err != nil {
		return CodexEnvironments{}, err
	}
	byID := map[string]*CodexEnvironment{}
	for _, task := range page.Tasks {
		if task.EnvironmentID == "" {
			continue
		}
		env, ok := byID[task.EnvironmentID]
		if !ok {
			env = &CodexEnvironment{ID: task.EnvironmentID}
			byID[task.EnvironmentID] = env
		}
		if env.Label == "" {
			env.Label = strings.TrimSpace(task.EnvironmentLabel)
		}
		env.Tasks++
	}
	out := CodexEnvironments{Source: CodexSourceTasks}
	for _, env := range byID {
		out.Environments = append(out.Environments, *env)
	}
	out.Environments = sortEnvironments(out.Environments)
	return out, nil
}

// readAuth reads the CLI's ChatGPT sign-in.
func (c Codex) readAuth() (codexAuth, error) {
	home, err := c.home()
	if err != nil {
		return codexAuth{}, err
	}
	raw, err := os.ReadFile(filepath.Join(home, "auth.json")) //nolint:gosec // the CLI's own auth file, in its own home
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return codexAuth{}, errNoChatGPTSignIn
		}
		return codexAuth{}, err
	}
	var auth codexAuth
	if err := json.Unmarshal(raw, &auth); err != nil {
		return codexAuth{}, fmt.Errorf("the Codex auth file is not JSON: %w", err)
	}
	if auth.Tokens == nil || auth.Tokens.AccessToken == "" {
		return codexAuth{}, errNoChatGPTSignIn
	}
	return auth, nil
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

func (c Codex) base() string {
	if c.BaseURL == "" {
		return codexDefaultBase
	}
	return strings.TrimRight(c.BaseURL, "/")
}

func (c Codex) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

func (c Codex) httpTimeout() time.Duration {
	if c.Timeout <= 0 || c.Timeout > 20*time.Second {
		return 20 * time.Second
	}
	return c.Timeout
}

// problemDetail is a refusal's own words: a problem's detail, else its text.
func problemDetail(err error) string {
	if pe := problem.From(err); pe != nil && pe.Detail != "" {
		return pe.Detail
	}
	return err.Error()
}
