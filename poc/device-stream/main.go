// Command device-stream is a proof of concept for "one device per session,
// streamed to the browser": the piece of the runner that would give each
// session its own Android emulator, pin the session's agent to it, and carry
// its screen and the reader's input to the console.
//
// The agent and the reader both drive the device through Argent: the agent
// with Argent's MCP tools, the reader through this server, which calls the
// same tool-server with the session's serial filled in on the host side. The
// browser only ever names a session, never a device.
package main

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

//go:embed index.html
var indexHTML []byte

type config struct {
	addr         string
	sdk          string
	image        string
	argentURL    string
	argentToken  string
	simServer    string
	worktrees    string
	firstPort    int
	maxSessions  int
	emulatorArgs []string
}

type session struct {
	ID       string `json:"id"`
	Serial   string `json:"serial"`
	AVD      string `json:"avd,omitempty"`
	Worktree string `json:"worktree"`
	State    string `json:"state"`
	Error    string `json:"error,omitempty"`

	port      int
	owned     bool
	streamURL string
	emulator  *exec.Cmd
	streamer  *exec.Cmd
	// Held so the streamer's stdin is not closed when the pipe is collected.
	streamIn io.WriteCloser
}

type host struct {
	cfg      config
	log      *slog.Logger
	mu       sync.Mutex
	sessions map[string]*session
	client   *http.Client
}

var sessionID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,40}$`)

func main() {
	var cfg config
	flag.StringVar(&cfg.addr, "addr", "127.0.0.1:8790", "listen address")
	flag.StringVar(&cfg.sdk, "sdk", os.Getenv("ANDROID_HOME"), "Android SDK root")
	flag.StringVar(&cfg.image, "image", "system-images;android-30;aosp_atd;x86_64", "system image for new session devices")
	flag.StringVar(&cfg.argentURL, "argent-url", "http://127.0.0.1:3001", "Argent tool-server URL")
	flag.StringVar(&cfg.argentToken, "argent-token", os.Getenv("ARGENT_AUTH_TOKEN"), "Argent tool-server bearer token")
	flag.StringVar(&cfg.simServer, "sim-server", "", "path to Argent's simulator-server binary")
	flag.StringVar(&cfg.worktrees, "worktrees", filepath.Join(os.TempDir(), "device-stream-worktrees"), "where session worktrees live")
	flag.IntVar(&cfg.firstPort, "first-port", 5556, "first emulator console port handed to a new session")
	flag.IntVar(&cfg.maxSessions, "max-sessions", 2, "devices this host may run at once")
	emuArgs := flag.String("emulator-args", "-no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect", "extra emulator flags")
	flag.Parse()
	cfg.emulatorArgs = strings.Fields(*emuArgs)

	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if cfg.simServer == "" {
		log.Error("-sim-server is required (Argent's bin/linux/simulator-server)")
		os.Exit(2)
	}
	h := &host{cfg: cfg, log: log, sessions: map[string]*session{}, client: &http.Client{Timeout: 30 * time.Second}}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
	mux.HandleFunc("GET /api/sessions", h.list)
	mux.HandleFunc("POST /api/sessions", h.create)
	mux.HandleFunc("DELETE /api/sessions/{id}", h.remove)
	mux.HandleFunc("GET /api/sessions/{id}/stream", h.stream)
	mux.HandleFunc("POST /api/sessions/{id}/input", h.input)

	log.Info("listening", "addr", cfg.addr)
	if err := http.ListenAndServe(cfg.addr, mux); err != nil {
		log.Error("serve", "err", err)
		os.Exit(1)
	}
}

func (h *host) list(w http.ResponseWriter, _ *http.Request) {
	h.mu.Lock()
	out := make([]session, 0, len(h.sessions))
	for _, s := range h.sessions {
		out = append(out, *s)
	}
	h.mu.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// create starts a session's device. With "serial" it adopts an emulator that
// is already running (what the demo does, since a software-emulated boot
// takes minutes); without it the session gets a fresh AVD of its own.
func (h *host) create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID     string `json:"id"`
		Serial string `json:"serial"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !sessionID.MatchString(req.ID) {
		problem(w, http.StatusBadRequest, "body must be {\"id\": \"<lowercase-slug>\", \"serial\"?: \"emulator-NNNN\"}")
		return
	}

	h.mu.Lock()
	if _, ok := h.sessions[req.ID]; ok {
		h.mu.Unlock()
		problem(w, http.StatusConflict, "session exists")
		return
	}
	if len(h.sessions) >= h.cfg.maxSessions {
		h.mu.Unlock()
		problem(w, http.StatusTooManyRequests, "this host runs its maximum number of devices")
		return
	}
	for _, s := range h.sessions {
		if req.Serial != "" && s.Serial == req.Serial {
			h.mu.Unlock()
			problem(w, http.StatusConflict, "device belongs to session "+s.ID)
			return
		}
	}
	s := &session{ID: req.ID, Serial: req.Serial, State: "starting", Worktree: filepath.Join(h.cfg.worktrees, req.ID)}
	if s.Serial == "" {
		s.owned = true
		s.port = h.freePortLocked()
		s.Serial = fmt.Sprintf("emulator-%d", s.port)
		s.AVD = "oppenheimer-" + req.ID
	}
	h.sessions[req.ID] = s
	h.mu.Unlock()

	go h.start(s)
	writeJSON(w, http.StatusAccepted, s)
}

func (h *host) freePortLocked() int {
	used := map[int]bool{}
	for _, s := range h.sessions {
		used[s.port] = true
	}
	p := h.cfg.firstPort
	for used[p] {
		p += 2 // the emulator takes the console port and the next one for adb
	}
	return p
}

func (h *host) start(s *session) {
	ctx := context.Background()
	fail := func(err error) {
		h.log.Error("session failed", "session", s.ID, "err", err)
		h.mu.Lock()
		s.State, s.Error = "failed", err.Error()
		h.mu.Unlock()
	}

	if s.owned {
		if err := h.createAVD(ctx, s.AVD); err != nil {
			fail(err)
			return
		}
		h.setState(s, "booting")
		emu := exec.Command(filepath.Join(h.cfg.sdk, "emulator", "emulator"),
			append([]string{"-avd", s.AVD, "-port", fmt.Sprint(s.port), "-grpc", fmt.Sprint(s.port + 3000)}, h.cfg.emulatorArgs...)...)
		emu.Env = append(os.Environ(), "ANDROID_HOME="+h.cfg.sdk)
		if err := emu.Start(); err != nil {
			fail(fmt.Errorf("start emulator: %w", err))
			return
		}
		h.mu.Lock()
		s.emulator = emu
		h.mu.Unlock()
	}
	if err := h.waitBooted(ctx, s.Serial, 30*time.Minute); err != nil {
		fail(err)
		return
	}
	if err := pinAgent(s.Worktree, s.Serial); err != nil {
		fail(err)
		return
	}
	h.setState(s, "streaming")
	streamURL, cmd, stdin, err := h.startStreamer(s.Serial)
	if err != nil {
		fail(err)
		return
	}
	h.mu.Lock()
	s.streamURL, s.streamer, s.streamIn, s.State = streamURL, cmd, stdin, "ready"
	h.mu.Unlock()
	h.log.Info("session ready", "session", s.ID, "serial", s.Serial, "stream", streamURL)
}

func (h *host) setState(s *session, state string) {
	h.mu.Lock()
	s.State = state
	h.mu.Unlock()
}

func (h *host) createAVD(ctx context.Context, name string) error {
	cmd := exec.CommandContext(ctx, filepath.Join(h.cfg.sdk, "cmdline-tools", "latest", "bin", "avdmanager"),
		"create", "avd", "--force", "-n", name, "-k", h.cfg.image, "-d", "pixel_4")
	cmd.Stdin = strings.NewReader("no\n")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("avdmanager create: %w: %s", err, tail(out))
	}
	return nil
}

func (h *host) adb(ctx context.Context, serial string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, filepath.Join(h.cfg.sdk, "platform-tools", "adb"), append([]string{"-s", serial}, args...)...).Output()
}

// waitBooted waits for the input service as well as boot_completed: on a slow
// host the watchdog can restart system_server after boot, and until it is
// back no tap lands. Then it keeps the screen on, since a sleeping display
// sends the streamer no frames.
func (h *host) waitBooted(ctx context.Context, serial string, limit time.Duration) error {
	deadline := time.Now().Add(limit)
	for time.Now().Before(deadline) {
		booted, _ := h.adb(ctx, serial, "shell", "getprop", "sys.boot_completed")
		input, _ := h.adb(ctx, serial, "shell", "service", "check", "input")
		if strings.TrimSpace(string(booted)) == "1" && strings.Contains(string(input), ": found") {
			h.adb(ctx, serial, "shell", "svc", "power", "stayon", "true")
			h.adb(ctx, serial, "shell", "input", "keyevent", "KEYCODE_WAKEUP")
			h.adb(ctx, serial, "shell", "wm", "dismiss-keyguard")
			return nil
		}
		time.Sleep(5 * time.Second)
	}
	return fmt.Errorf("%s did not boot within %s", serial, limit)
}

// pinAgent tells the session's agent which device is its own. Argent picks
// a device by "explicit user intent" first, so a line in the worktree's local
// instructions is enough for Claude Code; ANDROID_SERIAL makes plain adb in
// the session's shell default to the same device.
func pinAgent(worktree, serial string) error {
	if err := os.MkdirAll(worktree, 0o755); err != nil {
		return err
	}
	note := fmt.Sprintf(`# This session's device

This session has its own Android emulator: serial %[1]s.
Pass %[1]s as `+"`udid`"+` to every Argent tool. Do not use, boot, or shut down
any other device on this host: other sessions own them.
`, serial)
	if err := os.WriteFile(filepath.Join(worktree, "CLAUDE.local.md"), []byte(note), 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(worktree, "session.env"), []byte("ANDROID_SERIAL="+serial+"\n"), 0o644)
}

// startStreamer runs Argent's simulator-server for one device and returns the
// MJPEG URL it announces on stdout ("stream_ready http://…").
func (h *host) startStreamer(serial string) (string, *exec.Cmd, io.WriteCloser, error) {
	cmd := exec.Command(h.cfg.simServer, "android", "--id", serial)
	cmd.Env = append(os.Environ(), "ANDROID_HOME="+h.cfg.sdk)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", nil, nil, err
	}
	// The server reads commands on stdin; it stays open for the server's life.
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", nil, nil, err
	}
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		return "", nil, nil, fmt.Errorf("start simulator-server: %w", err)
	}
	found := make(chan string, 1)
	go func() {
		sc := bufio.NewScanner(stdout)
		url := regexp.MustCompile(`http://\S+`)
		for sc.Scan() {
			line := sc.Text()
			if strings.HasPrefix(line, "stream_ready ") {
				select {
				case found <- url.FindString(line):
				default:
				}
			}
		}
	}()
	select {
	case u := <-found:
		if !strings.Contains(u, ".mjpeg") {
			u = strings.TrimRight(u, "/") + "/stream.mjpeg"
		}
		return u, cmd, stdin, nil
	case <-time.After(60 * time.Second):
		cmd.Process.Kill()
		return "", nil, nil, errors.New("simulator-server never announced its stream")
	}
}

func (h *host) get(id string) (*session, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.sessions[id]
	if !ok {
		return nil, false
	}
	cp := *s
	return &cp, true
}

// stream relays the device's MJPEG stream. In the product this hop is the
// runner's link (or the WebRTC direct path), not a local HTTP proxy.
func (h *host) stream(w http.ResponseWriter, r *http.Request) {
	s, ok := h.get(r.PathValue("id"))
	if !ok || s.State != "ready" {
		problem(w, http.StatusNotFound, "no ready session with that id")
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, s.streamURL, nil)
	res, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		problem(w, http.StatusBadGateway, err.Error())
		return
	}
	defer res.Body.Close()
	w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(res.StatusCode)
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 64<<10)
	for {
		n, err := res.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

// input turns the reader's gesture into an Argent tool call on the session's
// own device. The browser cannot name another device: the serial comes from
// the session, here.
func (h *host) input(w http.ResponseWriter, r *http.Request) {
	s, ok := h.get(r.PathValue("id"))
	if !ok || s.State != "ready" {
		problem(w, http.StatusNotFound, "no ready session with that id")
		return
	}
	var in struct {
		Kind   string  `json:"kind"`
		X      float64 `json:"x"`
		Y      float64 `json:"y"`
		ToX    float64 `json:"toX"`
		ToY    float64 `json:"toY"`
		Text   string  `json:"text"`
		Key    string  `json:"key"`
		Button string  `json:"button"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		problem(w, http.StatusBadRequest, "bad input")
		return
	}
	var tool string
	args := map[string]any{"udid": s.Serial}
	switch in.Kind {
	case "tap":
		tool, args["x"], args["y"] = "gesture-tap", clamp(in.X), clamp(in.Y)
	case "swipe":
		tool = "gesture-swipe"
		args["fromX"], args["fromY"], args["toX"], args["toY"] = clamp(in.X), clamp(in.Y), clamp(in.ToX), clamp(in.ToY)
		args["momentum"] = false
	case "text":
		tool, args["text"] = "keyboard", in.Text
	case "key":
		tool, args["key"] = "keyboard", in.Key
	case "button":
		tool, args["button"] = "button", in.Button
	default:
		problem(w, http.StatusBadRequest, "kind must be tap, swipe, text, key or button")
		return
	}
	start := time.Now()
	body, status, err := h.callArgent(r.Context(), tool, args)
	if err != nil {
		problem(w, http.StatusBadGateway, err.Error())
		return
	}
	h.log.Info("input", "session", s.ID, "tool", tool, "status", status, "ms", time.Since(start).Milliseconds())
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

func (h *host) callArgent(ctx context.Context, tool string, args map[string]any) ([]byte, int, error) {
	payload, _ := json.Marshal(args)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(h.cfg.argentURL, "/")+"/tools/"+tool, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if h.cfg.argentToken != "" {
		req.Header.Set("Authorization", "Bearer "+h.cfg.argentToken)
	}
	res, err := h.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("argent tool-server: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	return body, res.StatusCode, err
}

// remove stops the session's streamer and, when the session created its
// device, kills the emulator and deletes the AVD.
func (h *host) remove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.mu.Lock()
	s, ok := h.sessions[id]
	delete(h.sessions, id)
	h.mu.Unlock()
	if !ok {
		problem(w, http.StatusNotFound, "no session with that id")
		return
	}
	if s.streamer != nil {
		s.streamer.Process.Kill()
	}
	if s.owned {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		h.adb(ctx, s.Serial, "emu", "kill")
		if s.emulator != nil {
			s.emulator.Wait()
		}
		exec.CommandContext(ctx, filepath.Join(h.cfg.sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "delete", "avd", "-n", s.AVD).Run()
	}
	os.RemoveAll(s.Worktree)
	w.WriteHeader(http.StatusNoContent)
}

func clamp(v float64) float64 { return min(1, max(0, v)) }

func tail(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 400 {
		s = s[len(s)-400:]
	}
	return s
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func problem(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"status": status, "title": http.StatusText(status), "detail": detail})
}
