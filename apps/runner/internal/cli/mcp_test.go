package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// `runner mcp` is the session commands as an MCP server: an agent that lists
// its tools finds them, a call reaches the daemon as the command would and
// answers what the command prints, and what the daemon refuses comes back as
// an error result the agent can read rather than a dead server.
func TestTheMCPServerRunsTheSessionCommandsAsTools(t *testing.T) {
	ctx := context.Background()
	places := fake.NewPlaces()
	terminals := fake.NewTerminals()
	svc, err := sessionsapp.New(sessionsapp.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: sessionsdomain.Layout{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	parent, err := svc.Create(ctx, sessionsapp.CreateInput{Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: sessionsdomain.AgentCodex})
	if err != nil {
		t.Fatal(err)
	}
	places.Folders[parent.Cwd()] = true

	socket := filepath.Join(t.TempDir(), "runner.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	children := sessionsapp.NewChildren(sessionsapp.ChildrenOptions{Sessions: svc, Terminals: terminals})
	app := &App{Sessions: svc, Children: children, Version: "test"}
	server := &http.Server{Handler: app.localRouter("", slog.New(slog.NewTextHandler(io.Discard, nil)))} //nolint:gosec // a test server on a private socket
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	requests := strings.Join([]string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}`,
		`{"jsonrpc":"2.0","method":"notifications/initialized"}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`,
		`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"start_session","arguments":{"task":"review src/x.go","agent":"claude"}}}`,
		`{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"send_to_session","arguments":{"id":"nosuchsession","message":"hello"}}}`,
		`{"jsonrpc":"2.0","id":5,"method":"no/such"}`,
	}, "\n") + "\n"
	var out bytes.Buffer
	d := Delegation{Socket: socket, Self: parent.ID}
	if err := MCP(ctx, strings.NewReader(requests), &out, d, "test"); err != nil {
		t.Fatal(err)
	}

	type answer struct {
		ID     int `json:"id"`
		Result struct {
			ProtocolVersion string                  `json:"protocolVersion"`
			Tools           []struct{ Name string } `json:"tools"`
			Content         []struct{ Text string } `json:"content"`
			IsError         bool                    `json:"isError"`
		} `json:"result"`
		Error *struct{ Code int } `json:"error"`
	}
	answers := map[int]answer{}
	for _, line := range strings.Split(strings.TrimSpace(out.String()), "\n") {
		var a answer
		if err := json.Unmarshal([]byte(line), &a); err != nil {
			t.Fatalf("not one JSON-RPC message per line: %q", line)
		}
		answers[a.ID] = a
	}
	if len(answers) != 5 {
		t.Fatalf("answered %d requests, want 5 (a notification gets none):\n%s", len(answers), out.String())
	}
	if answers[1].Result.ProtocolVersion != "2025-06-18" {
		t.Fatalf("initialize = %+v", answers[1])
	}
	var names []string
	for _, tool := range answers[2].Result.Tools {
		names = append(names, tool.Name)
	}
	for _, want := range []string{"start_session", "send_to_session", "list_children", "wait_for_children", "report_to_parent", "notify", "send_file", "watch_pull_request", "wake_in"} {
		if !strings.Contains(strings.Join(names, " "), want) {
			t.Fatalf("tools = %q, missing %q", names, want)
		}
	}
	started := answers[3].Result
	if started.IsError || len(started.Content) != 1 {
		t.Fatalf("start_session = %+v", started)
	}
	child, err := svc.Get(strings.TrimSpace(started.Content[0].Text))
	if err != nil || child.Parent != parent.ID {
		t.Fatalf("start_session answered %q, not a child of the caller: %+v, %v", started.Content[0].Text, child, err)
	}
	if refused := answers[4].Result; !refused.IsError || !strings.Contains(refused.Content[0].Text, "nosuchsession") {
		t.Fatalf("a refused send = %+v, want an error result naming the session", refused)
	}
	if answers[5].Error == nil || answers[5].Error.Code != -32601 {
		t.Fatalf("an unknown method = %+v", answers[5])
	}
}
