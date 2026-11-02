package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
)

// Stream is a viewer's connection to one terminal: bytes out of the
// program, keys into it.
type Stream interface {
	io.ReadWriter
	Close() error
	// Pids are processes that exist only because this viewer is attached
	// (the `tmux attach` client), counted in CPU accounting.
	Pids() []int
}

type Backend interface {
	Name() string
	Setup() error
	Teardown()
	Create(name, shellLine string) error
	Attach(name string, cols, rows int) (Stream, error)
	Capture(name string) (string, error)
	Kill(name string) error
	ServerPids() []int
}

const cols, rows = 132, 40 // the runner's launchCols × launchRows

// direct runs the program on a PTY the benchmark owns: no multiplexer, no
// persistence. The floor the other two are measured against.
type direct struct {
	mu    sync.Mutex
	terms map[string]*exec.Cmd
	files map[string]*os.File
}

func newDirect() *direct {
	return &direct{terms: map[string]*exec.Cmd{}, files: map[string]*os.File{}}
}
func (d *direct) Name() string { return "direct-pty" }
func (d *direct) Setup() error { return nil }
func (d *direct) Teardown() {
	for n := range d.terms {
		_ = d.Kill(n)
	}
}
func (d *direct) Create(name, line string) error {
	cmd := exec.Command("sh", "-c", line)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return err
	}
	d.mu.Lock()
	d.terms[name], d.files[name] = cmd, f
	d.mu.Unlock()
	return nil
}
func (d *direct) Attach(name string, _, _ int) (Stream, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	f, ok := d.files[name]
	if !ok {
		return nil, fmt.Errorf("no terminal %s", name)
	}
	return directStream{f}, nil
}
func (d *direct) Capture(string) (string, error) { return "", errors.ErrUnsupported }
func (d *direct) Kill(name string) error {
	d.mu.Lock()
	cmd, f := d.terms[name], d.files[name]
	delete(d.terms, name)
	delete(d.files, name)
	d.mu.Unlock()
	if cmd == nil {
		return nil
	}
	_ = cmd.Process.Kill()
	_, _ = cmd.Process.Wait()
	return f.Close()
}
func (d *direct) ServerPids() []int { return nil }

type directStream struct{ f *os.File }

func (s directStream) Read(p []byte) (int, error)  { return s.f.Read(p) }
func (s directStream) Write(p []byte) (int, error) { return s.f.Write(p) }
func (s directStream) Close() error                { return nil } // the PTY is the terminal
func (s directStream) Pids() []int                 { return nil }

// tmuxConfig is apps/runner/internal/sessions/adapters/tmux.Config, verbatim.
const tmuxConfig = `set -g status off
set -g mouse on
set -g set-clipboard on
set -g history-limit 50000
set -g escape-time 0
set -g focus-events on
set -g default-terminal "xterm-256color"
set -g window-size latest
set -g aggressive-resize on
unbind C-b
set -g prefix None
`

// tmuxBackend drives tmux the way the runner's tmux adapter does: one exec
// per command, `-u -L <socket> -f <config>`, attach as `tmux attach-session`
// on a PTY.
type tmuxBackend struct {
	socket, config string
}

func newTmux(dir string) *tmuxBackend {
	return &tmuxBackend{socket: "termbench", config: filepath.Join(dir, "tmux.conf")}
}
func (t *tmuxBackend) Name() string { return "tmux (runner)" }
func (t *tmuxBackend) args(rest ...string) []string {
	return append([]string{"-u", "-L", t.socket, "-f", t.config}, rest...)
}
func (t *tmuxBackend) run(rest ...string) (string, error) {
	out, err := exec.Command("tmux", t.args(rest...)...).CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("tmux %s: %v: %s", strings.Join(rest, " "), err, out)
	}
	return string(out), nil
}
func (t *tmuxBackend) Setup() error {
	_, _ = t.run("kill-server")
	if err := os.WriteFile(t.config, []byte(tmuxConfig), 0o600); err != nil {
		return err
	}
	// tmux exits with its last session; a host with a runner always has one.
	return t.Create("keepalive", "exec sleep 86400")
}
func (t *tmuxBackend) Teardown() { _, _ = t.run("kill-server") }
func (t *tmuxBackend) Create(name, line string) error {
	_, err := t.run("new-session", "-d", "-s", name, "-c", os.TempDir(),
		"-x", strconv.Itoa(cols), "-y", strconv.Itoa(rows), line)
	return err
}
func (t *tmuxBackend) Attach(name string, c, r int) (Stream, error) {
	cmd := exec.Command("tmux", t.args("attach-session", "-t", name)...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: uint16(c), Rows: uint16(r)})
	if err != nil {
		return nil, err
	}
	return &tmuxStream{f: f, cmd: cmd}, nil
}
func (t *tmuxBackend) Capture(name string) (string, error) {
	return t.run("capture-pane", "-p", "-t", name+":0")
}
func (t *tmuxBackend) Kill(name string) error {
	_, err := t.run("kill-session", "-t", name)
	return err
}
func (t *tmuxBackend) ServerPids() []int {
	out, err := t.run("display-message", "-p", "#{pid}")
	if err != nil {
		return nil
	}
	pid, _ := strconv.Atoi(strings.TrimSpace(out))
	return []int{pid}
}

type tmuxStream struct {
	f   *os.File
	cmd *exec.Cmd
}

func (s *tmuxStream) Read(p []byte) (int, error)  { return s.f.Read(p) }
func (s *tmuxStream) Write(p []byte) (int, error) { return s.f.Write(p) }
func (s *tmuxStream) Pids() []int                 { return []int{s.cmd.Process.Pid} }
func (s *tmuxStream) Close() error {
	err := s.f.Close()
	_ = s.cmd.Process.Kill()
	_, _ = s.cmd.Process.Wait()
	return err
}

// hcBackend drives herdr-core over its own socket: plain JSON-RPC for
// control on one long-lived connection (as a Go runner would hold it), and a
// framed connection per attach.
type hcBackend struct {
	bin, sock, dir string
	env            []string
	ctl            *rpcConn
}

func newHC(bin, dir string) *hcBackend {
	env := []string{
		"XDG_STATE_HOME=" + filepath.Join(dir, "state"),
		"XDG_CONFIG_HOME=" + filepath.Join(dir, "config"),
		"HC_SESSION=termbench",
		"HC_SOCKET=/tmp/hc-termbench.sock",
	}
	return &hcBackend{bin: bin, sock: "/tmp/hc-termbench.sock", dir: dir, env: env}
}
func (h *hcBackend) Name() string { return "herdr-core 0.1.16" }
func (h *hcBackend) cli(args ...string) (string, error) {
	cmd := exec.Command(h.bin, args...)
	cmd.Env = append(os.Environ(), h.env...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("hc %s: %v: %s", strings.Join(args, " "), err, out)
	}
	return string(out), nil
}
func (h *hcBackend) Setup() error {
	_, _ = h.cli("server", "stop")
	for _, d := range []string{"state", "config"} {
		p := filepath.Join(h.dir, d)
		_ = os.RemoveAll(p)
		if err := os.MkdirAll(p, 0o700); err != nil {
			return err
		}
	}
	// Any command that needs a core starts one in the background.
	if _, err := h.cli("ls"); err != nil {
		return err
	}
	c, err := dialRPC(h.sock)
	if err != nil {
		return err
	}
	h.ctl = c
	return nil
}
func (h *hcBackend) Teardown() {
	if h.ctl != nil {
		h.ctl.conn.Close()
	}
	_, _ = h.cli("server", "stop")
}
func (h *hcBackend) Create(name, line string) error {
	_, err := h.ctl.call("terminal.run", map[string]any{
		"argv": []string{"sh", "-c", line}, "name": name, "cwd": os.TempDir(),
		"env": map[string]string{"TERM": "xterm-256color"},
	})
	return err
}
func (h *hcBackend) Capture(name string) (string, error) {
	res, err := h.ctl.call("terminal.read", map[string]any{"terminal": name})
	if err != nil {
		return "", err
	}
	var r struct{ Text string }
	err = json.Unmarshal(res, &r)
	return r.Text, err
}
func (h *hcBackend) Kill(name string) error {
	if _, err := h.ctl.call("terminal.kill", map[string]any{"terminal": name}); err != nil {
		return err
	}
	_, err := h.ctl.call("terminal.rm", map[string]any{"terminal": name})
	return err
}
func (h *hcBackend) ServerPids() []int { return procsMatching(h.bin, " serve", " hold") }
func (h *hcBackend) Attach(name string, c, r int) (Stream, error) {
	return h.attach(name, c, r, 0)
}
func (h *hcBackend) attach(name string, c, r, history int) (Stream, error) {
	conn, err := net.Dial("unix", h.sock)
	if err != nil {
		return nil, err
	}
	br := bufio.NewReaderSize(conn, 64<<10)
	if _, err := writeLine(conn, 1, "hello", map[string]any{"framed": true, "generation": 1}); err != nil {
		conn.Close()
		return nil, err
	}
	if _, err := br.ReadBytes('\n'); err != nil {
		conn.Close()
		return nil, err
	}
	s := &hcStream{conn: conn, br: br, data: make(chan []byte, 1024)}
	req, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 2, "method": "terminal.attach",
		"params": map[string]any{"terminal": name, "cols": c, "rows": r, "history": history}})
	if err := s.frame(0, kindData, req); err != nil {
		conn.Close()
		return nil, err
	}
	// The attach reply precedes every stream frame.
	for {
		ch, kind, payload, err := readFrame(br)
		if err != nil {
			conn.Close()
			return nil, err
		}
		if ch != 0 || kind != kindData {
			continue
		}
		var resp struct {
			Result *struct{ Channel uint32 }
			Error  json.RawMessage
		}
		if err := json.Unmarshal(payload, &resp); err != nil {
			continue
		}
		if resp.Result == nil {
			conn.Close()
			return nil, fmt.Errorf("attach: %s", resp.Error)
		}
		s.channel = resp.Result.Channel
		break
	}
	go s.pump()
	return s, nil
}

const (
	kindData   = 0
	kindCredit = 1
	kindClose  = 2
)

type hcStream struct {
	conn    net.Conn
	br      *bufio.Reader
	channel uint32
	wmu     sync.Mutex
	data    chan []byte
	rest    []byte
	closed  bool
}

func (s *hcStream) frame(ch uint32, kind byte, payload []byte) error {
	hdr := make([]byte, 9, 9+len(payload))
	binary.LittleEndian.PutUint32(hdr[0:], ch)
	hdr[4] = kind
	binary.LittleEndian.PutUint32(hdr[5:], uint32(len(payload)))
	s.wmu.Lock()
	defer s.wmu.Unlock()
	_, err := s.conn.Write(append(hdr, payload...))
	return err
}

func readFrame(r *bufio.Reader) (uint32, byte, []byte, error) {
	var hdr [9]byte
	if _, err := io.ReadFull(r, hdr[:]); err != nil {
		return 0, 0, nil, err
	}
	n := binary.LittleEndian.Uint32(hdr[5:])
	payload := make([]byte, n)
	if _, err := io.ReadFull(r, payload); err != nil {
		return 0, 0, nil, err
	}
	return binary.LittleEndian.Uint32(hdr[0:]), hdr[4], payload, nil
}

func (s *hcStream) pump() {
	defer close(s.data)
	for {
		ch, kind, payload, err := readFrame(s.br)
		if err != nil {
			return
		}
		if ch == s.channel && kind == kindData {
			s.data <- payload
		}
		if ch == s.channel && kind == kindClose {
			return
		}
	}
}

// Read hands over stream bytes and returns the credit for them, as a viewer
// that has written them out would.
func (s *hcStream) Read(p []byte) (int, error) {
	if len(s.rest) == 0 {
		b, ok := <-s.data
		if !ok {
			return 0, io.EOF
		}
		s.rest = b
	}
	n := copy(p, s.rest)
	s.rest = s.rest[n:]
	var credit [4]byte
	binary.LittleEndian.PutUint32(credit[:], uint32(n))
	_ = s.frame(s.channel, kindCredit, credit[:])
	return n, nil
}
func (s *hcStream) Write(p []byte) (int, error) {
	if err := s.frame(s.channel, kindData, p); err != nil {
		return 0, err
	}
	return len(p), nil
}
func (s *hcStream) Pids() []int { return nil }
func (s *hcStream) Close() error {
	_ = s.frame(s.channel, kindClose, nil)
	return s.conn.Close()
}

// rpcConn is a plain-mode JSON-RPC connection: one message per line.
type rpcConn struct {
	conn net.Conn
	br   *bufio.Reader
	id   int
}

func dialRPC(sock string) (*rpcConn, error) {
	var conn net.Conn
	var err error
	for i := 0; i < 100; i++ {
		if conn, err = net.Dial("unix", sock); err == nil {
			return &rpcConn{conn: conn, br: bufio.NewReader(conn)}, nil
		}
		time.Sleep(20 * time.Millisecond)
	}
	return nil, err
}

func writeLine(w io.Writer, id int, method string, params any) (int, error) {
	b, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params})
	return w.Write(append(b, '\n'))
}

func (c *rpcConn) call(method string, params any) (json.RawMessage, error) {
	c.id++
	if _, err := writeLine(c.conn, c.id, method, params); err != nil {
		return nil, err
	}
	for {
		line, err := c.br.ReadBytes('\n')
		if err != nil {
			return nil, err
		}
		var resp struct {
			ID     *int
			Result json.RawMessage
			Error  json.RawMessage
		}
		if json.Unmarshal(line, &resp) != nil || resp.ID == nil || *resp.ID != c.id {
			continue
		}
		if len(resp.Error) > 0 && string(resp.Error) != "null" {
			return nil, fmt.Errorf("%s: %s", method, resp.Error)
		}
		return resp.Result, nil
	}
}

// procsMatching finds processes whose command line starts with bin and
// contains any of the markers.
func procsMatching(bin string, markers ...string) []int {
	entries, _ := os.ReadDir("/proc")
	var pids []int
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		raw, err := os.ReadFile(filepath.Join("/proc", e.Name(), "cmdline"))
		if err != nil {
			continue
		}
		cmd := strings.ReplaceAll(string(raw), "\x00", " ")
		if !strings.HasPrefix(cmd, bin) {
			continue
		}
		for _, m := range markers {
			if strings.Contains(cmd, m) {
				pids = append(pids, pid)
				break
			}
		}
	}
	return pids
}

// cpuTicks is utime+stime of a process, in clock ticks.
func cpuTicks(pid int) int64 {
	raw, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return 0
	}
	s := string(raw)
	fields := strings.Fields(s[strings.LastIndexByte(s, ')')+2:])
	u, _ := strconv.ParseInt(fields[11], 10, 64)
	st, _ := strconv.ParseInt(fields[12], 10, 64)
	return u + st
}

func cpuMs(pids []int) float64 {
	var t int64
	for _, p := range pids {
		t += cpuTicks(p)
	}
	return float64(t) * 1000 / 100 // USER_HZ is 100 on Linux
}

// pssKB is the proportional set size: shared pages split between sharers.
func pssKB(pid int) int {
	raw, err := os.ReadFile(fmt.Sprintf("/proc/%d/smaps_rollup", pid))
	if err != nil {
		return 0
	}
	for _, l := range strings.Split(string(raw), "\n") {
		if strings.HasPrefix(l, "Pss:") {
			n, _ := strconv.Atoi(strings.Fields(l)[1])
			return n
		}
	}
	return 0
}
