package cli

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// MCP is `runner mcp`: the commands an agent types in its session
// (`runner sessions run|send|children|wait|report|notify|send-file|watch-pr|
// wake-in`) as the tools of an MCP server on stdin and stdout, which the
// runner registers with each agent it launches (domain/briefing.go). Each
// tool is the command: the same Delegation call, its printed answer the
// tool's text, a problem the daemon answers an error result. It serves
// until stdin closes and the calls it started have answered.
//
// The transport is MCP's stdio one, a JSON-RPC message per line. A call runs
// on its own goroutine, so a `wait` that takes minutes does not hold up a
// ping; one writer at a time keeps the lines whole.
func MCP(ctx context.Context, in io.Reader, out io.Writer, d Delegation, version string) error {
	server := mcpServer{d: d, version: version, out: out}
	var calls sync.WaitGroup
	lines := bufio.NewScanner(in)
	lines.Buffer(make([]byte, 0, 64<<10), 4<<20)
	for lines.Scan() {
		line := bytes.TrimSpace(lines.Bytes())
		if len(line) == 0 {
			continue
		}
		var req mcpRequest
		if err := json.Unmarshal(line, &req); err != nil {
			server.reply(nil, nil, &mcpError{Code: -32700, Message: "not JSON: " + err.Error()})
			continue
		}
		if req.Method == "tools/call" && req.ID != nil {
			calls.Add(1)
			go func() {
				defer calls.Done()
				server.handle(ctx, req)
			}()
			continue
		}
		server.handle(ctx, req)
	}
	// A call still running finishes and answers: a client that wrote its
	// requests and closed stdin still reads them. One that is going away
	// stops the process, which cancels ctx.
	calls.Wait()
	return lines.Err()
}

type mcpRequest struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type mcpError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpServer struct {
	d       Delegation
	version string
	mu      sync.Mutex
	out     io.Writer
}

// handle answers one request. A notification (no id) gets no answer, as
// JSON-RPC has it; the ones a client sends (initialized, cancelled) need
// nothing from this server.
func (s *mcpServer) handle(ctx context.Context, req mcpRequest) {
	if req.ID == nil {
		return
	}
	switch req.Method {
	case "initialize":
		var params struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		_ = json.Unmarshal(req.Params, &params)
		version := params.ProtocolVersion
		if version == "" {
			version = "2025-06-18"
		}
		s.reply(req.ID, map[string]any{
			"protocolVersion": version,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "oppenheimer", "version": s.version},
			"instructions":    mcpInstructions,
		}, nil)
	case "ping":
		s.reply(req.ID, map[string]any{}, nil)
	case "tools/list":
		s.reply(req.ID, map[string]any{"tools": mcpTools}, nil)
	case "tools/call":
		var params struct {
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			s.reply(req.ID, nil, &mcpError{Code: -32602, Message: err.Error()})
			return
		}
		text, err := s.call(ctx, params.Name, params.Arguments)
		if err != nil {
			text = strings.TrimSpace(text + "\n" + err.Error())
		}
		s.reply(req.ID, map[string]any{
			"content": []map[string]any{{"type": "text", "text": text}},
			"isError": err != nil,
		}, nil)
	default:
		s.reply(req.ID, nil, &mcpError{Code: -32601, Message: "no method " + req.Method})
	}
}

func (s *mcpServer) reply(id json.RawMessage, result any, failure *mcpError) {
	message := map[string]any{"jsonrpc": "2.0", "id": id}
	if id == nil {
		message["id"] = nil
	}
	if failure != nil {
		message["error"] = failure
	} else {
		message["result"] = result
	}
	encoded, err := json.Marshal(message)
	if err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	_, _ = s.out.Write(append(encoded, '\n'))
}

// mcpArgs is every tool's arguments; each tool reads its own.
type mcpArgs struct {
	Task           string   `json:"task"`
	Agent          string   `json:"agent"`
	Name           string   `json:"name"`
	Repo           string   `json:"repo"`
	Base           string   `json:"base"`
	OutliveParent  bool     `json:"outlive_parent"`
	Keep           bool     `json:"keep"`
	ID             string   `json:"id"`
	IDs            []string `json:"ids"`
	Message        string   `json:"message"`
	TimeoutMinutes int      `json:"timeout_minutes"`
	Path           string   `json:"path"`
	Caption        string   `json:"caption"`
	Number         int      `json:"number"`
	Off            bool     `json:"off"`
	Delay          string   `json:"delay"`
}

// call runs one tool as its command, returning what the command prints.
func (s *mcpServer) call(ctx context.Context, name string, raw json.RawMessage) (string, error) {
	var args mcpArgs
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return "", fmt.Errorf("arguments: %w", err)
		}
	}
	var out bytes.Buffer
	d := s.d
	d.Out = &out
	err := s.run(ctx, d, name, args)
	return strings.TrimSpace(out.String()), err
}

func (s *mcpServer) run(ctx context.Context, d Delegation, name string, args mcpArgs) error {
	switch name {
	case "start_session":
		if args.Task == "" {
			return errors.New("task is required")
		}
		agent := args.Agent
		if agent == "" {
			agent = "claude"
		}
		return d.Run(ctx, ChildOptions{
			Agent: agent, Name: args.Name, Repo: args.Repo, Base: args.Base,
			OutliveParent: args.OutliveParent, Keep: args.Keep,
		}, args.Task)
	case "send_to_session":
		if args.ID == "" || args.Message == "" {
			return errors.New("id and message are required")
		}
		return d.Send(ctx, args.ID, args.Message)
	case "list_children":
		return d.Children(ctx, "")
	case "wait_for_children":
		timeout := 10 * time.Minute
		if args.TimeoutMinutes > 0 {
			timeout = time.Duration(args.TimeoutMinutes) * time.Minute
		}
		return d.Wait(ctx, "", args.IDs, timeout)
	case "report_to_parent":
		if args.Message == "" {
			return errors.New("message is required")
		}
		return d.Report(ctx, args.Message)
	case "notify":
		if args.Message == "" {
			return errors.New("message is required")
		}
		return d.Notify(ctx, args.Message)
	case "send_file":
		if args.Path == "" {
			return errors.New("path is required")
		}
		return d.SendFile(ctx, args.Path, args.Caption)
	case "watch_pull_request":
		if args.Number < 1 {
			return errors.New("number is required")
		}
		return d.WatchPull(ctx, args.Repo, args.Number, !args.Off)
	case "wake_in":
		if args.Delay == "" || args.Message == "" {
			return errors.New("delay and message are required")
		}
		delay, err := ParseWakeDelay(args.Delay)
		if err != nil {
			return err
		}
		return d.WakeIn(ctx, delay, args.Message)
	}
	return fmt.Errorf("no tool %q", name)
}

const mcpInstructions = "Tools for the Oppenheimer session this agent runs in: start other agents as sessions " +
	"of your own and hear back from them, tell the person, show them a file, and be woken later or by a " +
	"pull request. They are the `runner sessions` commands; `runner --skill` is the full manual."

// mcpTools is what tools/list answers: each command, described for the
// agent that will choose it.
var mcpTools = []map[string]any{
	mcpTool("start_session", "Start another agent as a child session of this one, with a task. "+
		"By default it runs in this session's folder, on the same files: give it work that does not collide with yours. "+
		"Answers the child's id.", map[string]any{
		"task":           mcpString("The child's first message."),
		"agent":          mcpString("claude (default), codex, opencode, grok, pi or shell."),
		"name":           mcpString("A name for the child."),
		"repo":           mcpString("owner/name: give the child a checkout of its own, cut from a pushed branch."),
		"base":           mcpString("With repo, the branch to cut it from."),
		"outlive_parent": mcpBool("Keep the child running when this session ends."),
		"keep":           mcpBool("Bring the child back on its own after the host reboots."),
	}, "task"),
	mcpTool("send_to_session", "Type a message into a child session's agent and submit it.", map[string]any{
		"id":      mcpString("The session's id."),
		"message": mcpString("What to send."),
	}, "id", "message"),
	mcpTool("list_children", "List this session's children: their state and what they last said.", map[string]any{}),
	mcpTool("wait_for_children", "Wait until the children have finished, are blocked, or ended. They keep running past the timeout.", map[string]any{
		"ids":             map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Only these children (default: all)."},
		"timeout_minutes": map[string]any{"type": "integer", "description": "How long to wait (default 10)."},
	}),
	mcpTool("report_to_parent", "As a child, tell the session that started you what you found or did.", map[string]any{
		"message": mcpString("The report."),
	}, "message"),
	mcpTool("notify", "Put a line in the person's Inbox in the console, for something they should know or act on.", map[string]any{
		"message": mcpString("The line."),
	}, "message"),
	mcpTool("send_file", "Show the person a file in this session's chat: an image as a picture, a small text file as its text.", map[string]any{
		"path":    mcpString("The file, absolute or relative to where you run."),
		"caption": mcpString("A line about the file."),
	}, "path"),
	mcpTool("watch_pull_request", "Be woken when your pull request's checks finish, someone reviews or comments, or it merges. End your turn after.", map[string]any{
		"number": map[string]any{"type": "integer", "description": "The pull request's number."},
		"repo":   mcpString("owner/name (default: this session's first checkout)."),
		"off":    mcpBool("Stop watching it."),
	}, "number"),
	mcpTool("wake_in", "Be woken later with a message to yourself. End your turn after.", map[string]any{
		"delay":   mcpString("30m, 2h, 1d and the like."),
		"message": mcpString("What to tell yourself then."),
	}, "delay", "message"),
}

func mcpTool(name, description string, properties map[string]any, required ...string) map[string]any {
	schema := map[string]any{"type": "object", "properties": properties}
	if len(required) > 0 {
		schema["required"] = required
	}
	return map[string]any{"name": name, "description": description, "inputSchema": schema}
}

func mcpString(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func mcpBool(description string) map[string]any {
	return map[string]any{"type": "boolean", "description": description}
}
