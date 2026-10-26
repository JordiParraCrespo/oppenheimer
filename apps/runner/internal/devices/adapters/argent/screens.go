// Package argent reaches a host's devices through Argent (Software Mansion's
// toolkit for agents and simulators): its simulator-server streams a device's
// screen, its tool-server applies input. The session's agent drives the same
// devices through the same tool-server, so the reader and the agent act on
// one device through one door.
package argent

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/domain"
)

// maxFrameBytes bounds one JPEG frame; anything larger is not a screen.
const maxFrameBytes = 4 << 20

// readyTimeout is how long a simulator-server has to announce its stream.
const readyTimeout = 60 * time.Second

var streamURL = regexp.MustCompile(`http://\S+`)

// ScreensOptions locate Argent's simulator-server.
type ScreensOptions struct {
	// Binary is the simulator-server's path (Argent's bin/<os>/simulator-server).
	Binary string
	// AndroidHome is the Android SDK the server finds adb and the emulator's
	// gRPC port through; empty keeps the runner's own environment.
	AndroidHome string
	HTTP        *http.Client
}

// Screens runs one simulator-server per device, started on first watch and
// shared by every viewer of it, and reads each viewer's MJPEG stream.
type Screens struct {
	opts    ScreensOptions
	mu      sync.Mutex
	servers map[string]*server
}

type server struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser // held open: the server reads commands on it
	stream string
	done   chan struct{}
}

var _ app.Screens = (*Screens)(nil)

// NewScreens builds the adapter; no server runs until a device is watched.
func NewScreens(opts ScreensOptions) *Screens {
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{}
	}
	return &Screens{opts: opts, servers: map[string]*server{}}
}

// Open starts (or reuses) the device's simulator-server and opens one stream.
func (s *Screens) Open(ctx context.Context, device domain.Device) (app.Screen, error) {
	url, err := s.streamFor(device)
	if err != nil {
		return nil, err
	}
	streamCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	req, err := http.NewRequestWithContext(streamCtx, http.MethodGet, url, nil)
	if err != nil {
		cancel()
		return nil, err
	}
	res, err := s.opts.HTTP.Do(req)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("open the screen stream: %w", err)
	}
	if res.StatusCode != http.StatusOK {
		_ = res.Body.Close()
		cancel()
		return nil, fmt.Errorf("the screen stream answered %s", res.Status)
	}
	return &screen{body: res.Body, reader: newReader(res.Body), cancel: cancel}, nil
}

// Close stops every simulator-server this adapter started.
func (s *Screens) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for serial, srv := range s.servers {
		_ = srv.cmd.Process.Kill()
		delete(s.servers, serial)
	}
}

func (s *Screens) streamFor(device domain.Device) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if srv, ok := s.servers[device.Serial]; ok {
		select {
		case <-srv.done:
			delete(s.servers, device.Serial)
		default:
			return srv.stream, nil
		}
	}
	srv, err := s.start(device)
	if err != nil {
		return "", err
	}
	s.servers[device.Serial] = srv
	return srv.stream, nil
}

func (s *Screens) start(device domain.Device) (*server, error) {
	if s.opts.Binary == "" {
		return nil, errors.New("no Argent simulator-server is configured")
	}
	cmd := exec.Command(s.opts.Binary, string(device.Platform), "--id", device.Serial)
	cmd.Env = os.Environ()
	if s.opts.AndroidHome != "" {
		cmd.Env = append(cmd.Env, "ANDROID_HOME="+s.opts.AndroidHome)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start the simulator-server: %w", err)
	}
	srv := &server{cmd: cmd, stdin: stdin, done: make(chan struct{})}
	ready := make(chan string, 1)
	go func() {
		lines := bufio.NewScanner(stdout)
		for lines.Scan() {
			// "stream_ready http://127.0.0.1:NNNN/stream.mjpeg"
			if line := lines.Text(); strings.HasPrefix(line, "stream_ready ") {
				select {
				case ready <- streamURL.FindString(line):
				default:
				}
			}
		}
	}()
	go func() {
		_ = cmd.Wait()
		close(srv.done)
	}()
	select {
	case url := <-ready:
		if !strings.Contains(url, ".mjpeg") {
			url = strings.TrimRight(url, "/") + "/stream.mjpeg"
		}
		srv.stream = url
		return srv, nil
	case <-srv.done:
		return nil, errors.New("the simulator-server exited before its stream was ready")
	case <-time.After(readyTimeout):
		_ = cmd.Process.Kill()
		return nil, errors.New("the simulator-server never announced its stream")
	}
}

// screen cuts one MJPEG stream into whole JPEG frames. A part's
// Content-Length is used when the server sends one; otherwise the image runs
// from its start marker to its end marker, which is how a frame is known to
// be whole as soon as its last byte arrives rather than when the next one
// starts.
type screen struct {
	body   io.ReadCloser
	reader *bufio.Reader
	cancel context.CancelFunc
}

func newReader(body io.Reader) *bufio.Reader { return bufio.NewReaderSize(body, 256<<10) }

var (
	jpegStart = []byte{0xff, 0xd8}
	jpegEnd   = []byte{0xff, 0xd9}
)

func (sc *screen) Next(ctx context.Context) ([]byte, error) {
	stop := context.AfterFunc(ctx, sc.cancel)
	defer stop()
	frame, err := sc.next()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return frame, err
}

func (sc *screen) next() ([]byte, error) {
	length := -1
	// The part's headers, up to the blank line before the image.
	for {
		line, err := sc.reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if name, value, ok := strings.Cut(line, ":"); ok && strings.EqualFold(strings.TrimSpace(name), "Content-Length") {
			if n, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && n > 0 && n <= maxFrameBytes {
				length = n
			}
		}
		if line == "" {
			if peek, err := sc.reader.Peek(2); err == nil && bytes.Equal(peek, jpegStart) {
				break
			}
		}
	}
	if length > 0 {
		frame := make([]byte, length)
		if _, err := io.ReadFull(sc.reader, frame); err != nil {
			return nil, err
		}
		return frame, nil
	}
	var frame []byte
	for {
		chunk, err := sc.reader.ReadSlice(0xd9)
		frame = append(frame, chunk...)
		if len(frame) > maxFrameBytes {
			return nil, errors.New("a screen frame larger than any screen")
		}
		if err != nil && !errors.Is(err, bufio.ErrBufferFull) {
			return nil, err
		}
		if err == nil && bytes.HasSuffix(frame, jpegEnd) {
			return frame, nil
		}
	}
}

func (sc *screen) Close() error {
	sc.cancel()
	return sc.body.Close()
}
