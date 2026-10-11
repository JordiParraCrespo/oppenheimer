// Command netsim puts the machines of a local stack on simulated networks:
// the relay in a data centre, the browser in a hotel in Tokyo, a host behind
// ADSL in Barcelona. Each node but the relay gets a network namespace of its
// own, joined to the others through one TUN device each and this process,
// which delays, throttles and drops every packet the way the two last miles
// and the distance between them would (profiles.json). The relay is the root
// namespace, where the API and the console already run.
//
// Inside a node, its own loopback ports forward to the relay's, so a process
// there reaches `localhost:3001` exactly as it would without the simulation —
// only farther away. Between nodes, packets go node to node: a WebRTC path
// between the browser and a host never touches the relay's side.
//
//	netsim up --config nodes.json --state DIR [--control 127.0.0.1:7077]
//	netsim exec --state DIR NODE -- COMMAND [ARGS...]
//
// Linux only, and root: namespaces and TUN devices. No netem needed, so it
// runs on kernels built without it.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// Config is the file `up` reads: the relay's placement and the ports it
// serves, then every other node.
type Config struct {
	Relay      Placement    `json:"relay"`
	RelayPorts []int        `json:"relayPorts"`
	Nodes      []NodeConfig `json:"nodes"`
}

// NodeConfig is one simulated machine.
type NodeConfig struct {
	Name      string    `json:"name"`
	Placement Placement `json:"placement"`
	// Ports on the node's loopback that forward to the same port on the relay.
	Ports []int `json:"ports"`
}

var nodeName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,30}$`)

// relayAddr is the relay's address on the simulated network; node i is
// 10.77.i.2.
var relayAddr = net.IPv4(10, 77, 0, 1)

func nodeAddr(i int) net.IP { return net.IPv4(10, 77, byte(i), 2) }

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	var err error
	switch os.Args[1] {
	case "up":
		err = up(os.Args[2:])
	case "exec":
		err = execCmd(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "netsim:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: netsim up --config FILE --state DIR [--control ADDR] | netsim exec --state DIR NODE -- COMMAND...")
	os.Exit(2)
}

func nsPath(state, node string) string { return filepath.Join(state, "ns", node) }

func execCmd(args []string) error {
	fs := flag.NewFlagSet("exec", flag.ExitOnError)
	state := fs.String("state", "", "the state directory `up` was given")
	_ = fs.Parse(args)
	rest := fs.Args()
	if *state == "" || len(rest) < 3 || rest[1] != "--" {
		usage()
	}
	return execIn(nsPath(*state, rest[0]), rest[2:])
}

func up(args []string) error {
	fs := flag.NewFlagSet("up", flag.ExitOnError)
	configPath := fs.String("config", "", "the nodes, as JSON")
	state := fs.String("state", "", "where the namespaces are pinned")
	control := fs.String("control", "127.0.0.1:7077", "the control endpoint's address")
	_ = fs.Parse(args)
	if *configPath == "" || *state == "" {
		usage()
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	raw, err := os.ReadFile(*configPath)
	if err != nil {
		return err
	}
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("%s: %w", *configPath, err)
	}
	profiles, err := loadProfiles()
	if err != nil {
		return err
	}
	placements := []Placement{cfg.Relay}
	names := []string{"relay"}
	for _, n := range cfg.Nodes {
		if !nodeName.MatchString(n.Name) || n.Name == "relay" {
			return fmt.Errorf("node name %q: lowercase letters, digits and dashes, not relay", n.Name)
		}
		placements = append(placements, n.Placement)
		names = append(names, n.Name)
	}
	if len(placements) > 250 {
		return errors.New("at most 249 nodes")
	}
	for i, p := range placements {
		if err := profiles.validate(p); err != nil {
			return fmt.Errorf("%s: %w", names[i], err)
		}
	}

	if err := os.MkdirAll(filepath.Join(*state, "ns"), 0o750); err != nil {
		return err
	}
	_ = os.Remove(filepath.Join(*state, "ready"))

	tuns := make([]int, len(placements))
	addrs := make([][4]byte, len(placements))
	defer func() {
		for _, fd := range tuns {
			if fd > 0 {
				_ = unix.Close(fd)
			}
		}
		for _, n := range cfg.Nodes {
			dropNetns(nsPath(*state, n.Name))
		}
	}()

	tuns[0], err = openTun("netsim0")
	if err != nil {
		return fmt.Errorf("the relay's device (is another netsim running?): %w", err)
	}
	if err := configure("netsim0", relayAddr, net.IPv4(255, 255, 0, 0)); err != nil {
		return err
	}
	copy(addrs[0][:], relayAddr.To4())

	for i, n := range cfg.Nodes {
		idx := i + 1
		path := nsPath(*state, n.Name)
		dropNetns(path)
		if err := newNetns(path); err != nil {
			return fmt.Errorf("%s: %w", n.Name, err)
		}
		err := inNetns(path, func() error {
			if err := configure("lo", nil, nil); err != nil {
				return err
			}
			fd, err := openTun("sim0")
			if err != nil {
				return err
			}
			tuns[idx] = fd
			return configure("sim0", nodeAddr(idx), net.IPv4(255, 255, 0, 0))
		})
		if err != nil {
			return fmt.Errorf("%s: %w", n.Name, err)
		}
		copy(addrs[idx][:], nodeAddr(idx).To4())
	}

	model := newModel(profiles, placements, rand.Float64, rand.NormFloat64)
	router := newRouter(model, tuns, addrs, logger)
	router.run()

	for _, port := range cfg.RelayPorts {
		if err := relayForward(port, logger); err != nil {
			return err
		}
	}
	for _, n := range cfg.Nodes {
		for _, port := range n.Ports {
			if err := nodeForward(nsPath(*state, n.Name), port, logger); err != nil {
				return fmt.Errorf("%s: %w", n.Name, err)
			}
		}
	}

	server := &http.Server{
		Addr:              *control,
		Handler:           controlHandler(names, model, router, profiles),
		ReadHeaderTimeout: 5 * time.Second,
	}
	listener, err := listen("tcp", *control)
	if err != nil {
		return err
	}
	go func() { _ = server.Serve(listener) }()

	ready := map[string]any{"control": "http://" + *control, "nodes": names}
	body, _ := json.Marshal(ready)
	if err := os.WriteFile(filepath.Join(*state, "ready"), body, 0o600); err != nil {
		return err
	}
	logger.Info("netsim up", slog.Any("nodes", names), slog.String("control", *control))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	_ = server.Close()
	_ = os.Remove(filepath.Join(*state, "ready"))
	return nil
}

// relayForward makes the relay's port reachable on its simulated address.
// A service already listening on every address needs nothing.
func relayForward(port int, logger *slog.Logger) error {
	addr := fmt.Sprintf("%s:%d", relayAddr, port)
	l, err := listen("tcp4", addr)
	if errors.Is(err, unix.EADDRINUSE) {
		return nil
	}
	if err != nil {
		return err
	}
	target := fmt.Sprintf("localhost:%d", port)
	go serve(l, func() (net.Conn, error) { return dial("tcp", target) }, logger)
	return nil
}

// nodeForward listens on the node's loopback and dials the relay from inside
// the node, so the connection crosses the simulated network.
func nodeForward(ns string, port int, logger *slog.Logger) error {
	target := fmt.Sprintf("%s:%d", relayAddr, port)
	dial := func() (net.Conn, error) {
		var c net.Conn
		err := inNetns(ns, func() error {
			var err error
			c, err = dial("tcp4", target)
			return err
		})
		return c, err
	}
	return inNetns(ns, func() error {
		l, err := listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			return err
		}
		go serve(l, dial, logger)
		// localhost may resolve to ::1 first.
		if l6, err := listen("tcp6", fmt.Sprintf("[::1]:%d", port)); err == nil {
			go serve(l6, dial, logger)
		}
		return nil
	})
}

// The forwarders live as long as the process; nothing cancels them.
func listen(network, addr string) (net.Listener, error) {
	var lc net.ListenConfig
	return lc.Listen(context.Background(), network, addr)
}

func dial(network, addr string) (net.Conn, error) {
	d := net.Dialer{Timeout: 10 * time.Second}
	return d.DialContext(context.Background(), network, addr)
}

func serve(l net.Listener, dial func() (net.Conn, error), logger *slog.Logger) {
	for {
		in, err := l.Accept()
		if err != nil {
			return
		}
		go func() {
			out, err := dial()
			if err != nil {
				logger.Debug("forward", slog.Any("error", err))
				_ = in.Close()
				return
			}
			pipe(in, out)
		}()
	}
}

func pipe(a, b net.Conn) {
	done := make(chan struct{}, 2)
	half := func(dst, src net.Conn) {
		_, _ = io.Copy(dst, src)
		if tc, ok := dst.(*net.TCPConn); ok {
			_ = tc.CloseWrite()
		}
		done <- struct{}{}
	}
	go half(a, b)
	go half(b, a)
	<-done
	<-done
	_ = a.Close()
	_ = b.Close()
}

type legJSON struct {
	From string `json:"from"`
	To   string `json:"to"`
	LegStats
}

func controlHandler(names []string, model *Model, router *Router, profiles *Profiles) http.Handler {
	index := map[string]int{}
	for i, n := range names {
		index[n] = i
	}
	mux := http.NewServeMux()
	writeJSON := func(w http.ResponseWriter, v any) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(v)
	}
	mux.HandleFunc("GET /profiles", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, profiles) })
	mux.HandleFunc("GET /nodes", func(w http.ResponseWriter, _ *http.Request) {
		out := make([]map[string]any, len(names))
		for i, n := range names {
			addr := relayAddr
			if i > 0 {
				addr = nodeAddr(i)
			}
			out[i] = map[string]any{"name": n, "addr": addr.String(), "placement": model.Placement(i)}
		}
		writeJSON(w, out)
	})
	mux.HandleFunc("PUT /nodes/{name}", func(w http.ResponseWriter, r *http.Request) {
		i, ok := index[r.PathValue("name")]
		if !ok {
			http.Error(w, "no such node", http.StatusNotFound)
			return
		}
		var p Placement
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&p); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := model.Place(i, p); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /stats", func(w http.ResponseWriter, _ *http.Request) {
		out := []legJSON{}
		for k, v := range router.Stats() {
			out = append(out, legJSON{From: names[k[0]], To: names[k[1]], LegStats: v})
		}
		writeJSON(w, out)
	})
	mux.HandleFunc("DELETE /stats", func(w http.ResponseWriter, _ *http.Request) {
		router.ResetStats()
		w.WriteHeader(http.StatusNoContent)
	})
	return mux
}
