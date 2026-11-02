// termbench measures the terminal layer under the runner: tmux driven the
// way apps/runner drives it, herdr-core driven over its own socket, and a
// bare PTY as the floor.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

type chunk struct {
	at   time.Time
	text string
}

// viewer reads a stream on its own goroutine, timestamps each read as it
// returns, and keeps only the visible text (escape sequences stripped), so
// a match is never a byte inside a cursor move.
type viewer struct {
	s     Stream
	ch    chan chunk
	bytes atomic.Int64
	first atomic.Int64 // unix nanos of the first byte
	tail  string
}

func watch(s Stream) *viewer {
	v := &viewer{s: s, ch: make(chan chunk, 1<<16)}
	go func() {
		defer close(v.ch)
		var vt vtText
		buf := make([]byte, 32<<10) // the runner reads 32 KB
		for {
			n, err := s.Read(buf)
			if n > 0 {
				at := time.Now()
				v.first.CompareAndSwap(0, at.UnixNano())
				v.bytes.Add(int64(n))
				if t := vt.feed(buf[:n]); t != "" {
					v.ch <- chunk{at, t}
				}
			}
			if err != nil {
				return
			}
		}
	}()
	return v
}

func (v *viewer) waitFor(sub string, timeout time.Duration) (time.Time, error) {
	deadline := time.After(timeout)
	for {
		select {
		case c, ok := <-v.ch:
			if !ok {
				return time.Time{}, fmt.Errorf("stream ended before %q", sub)
			}
			hay := v.tail + c.text
			if strings.Contains(hay, sub) {
				v.tail = ""
				return c.at, nil
			}
			if len(hay) > len(sub) {
				hay = hay[len(hay)-len(sub):]
			}
			v.tail = hay
		case <-deadline:
			return time.Time{}, fmt.Errorf("timeout waiting for %q", sub)
		}
	}
}

func (v *viewer) drain(quiet time.Duration) {
	for {
		select {
		case _, ok := <-v.ch:
			if !ok {
				return
			}
		case <-time.After(quiet):
			v.tail = ""
			return
		}
	}
}

// vtText strips CSI, OSC, DCS/APC/PM/SOS and two-byte escapes.
type vtText struct{ st int }

func (v *vtText) feed(p []byte) string {
	var b strings.Builder
	for _, c := range p {
		switch v.st {
		case 0:
			if c == 0x1b {
				v.st = 1
			} else if c >= 0x20 || c == '\n' {
				b.WriteByte(c)
			}
		case 1:
			switch c {
			case '[':
				v.st = 2
			case ']', 'P', 'X', '^', '_':
				v.st = 3
			case '(', ')', '*', '+', '#', '%', ' ':
				v.st = 5
			default:
				v.st = 0
			}
		case 2:
			if c >= 0x40 && c <= 0x7e {
				v.st = 0
			}
		case 3:
			if c == 0x07 {
				v.st = 0
			} else if c == 0x1b {
				v.st = 4
			}
		case 4:
			if c == '\\' {
				v.st = 0
			} else {
				v.st = 3
			}
		case 5:
			v.st = 0
		}
	}
	return b.String()
}

type dist struct {
	N                        int
	P50, P90, P99, Max, Mean float64 // ms
	Errors                   int
}

func summarize(ms []float64, errs int) dist {
	if len(ms) == 0 {
		return dist{Errors: errs}
	}
	sort.Float64s(ms)
	at := func(q float64) float64 { return ms[min(len(ms)-1, int(q*float64(len(ms))))] }
	var sum float64
	for _, x := range ms {
		sum += x
	}
	return dist{N: len(ms), P50: at(.5), P90: at(.9), P99: at(.99), Max: ms[len(ms)-1], Mean: sum / float64(len(ms)), Errors: errs}
}

func msSince(t0 time.Time, t1 time.Time) float64 { return float64(t1.Sub(t0).Microseconds()) / 1000 }

func median(xs []float64) float64 {
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	return s[len(s)/2]
}

type results map[string]map[string]any // test → backend → result

func (r results) put(test, backend string, v any) {
	if r[test] == nil {
		r[test] = map[string]any{}
	}
	r[test][backend] = v
	j, _ := json.Marshal(v)
	fmt.Fprintf(os.Stderr, "  %-28s %-20s %s\n", test, backend, j)
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

// echo: one key in, its echo out, as `cat` on a raw terminal answers it.
// With load, a second terminal on the same server prints flat out to an
// attached, draining viewer the whole time.
func testEcho(b Backend, r results, n int, load string) {
	test := "echo"
	if load != "" {
		test = "echo, busy neighbour " + load
		if !strings.Contains(load, "MB/s") {
			test = "echo, flat-out neighbour " + load
		}
		line := "exec yes 'cargo build: compiling crate 4711 of 9000 ... ok'"
		if strings.Contains(load, "MB/s") {
			line = "while :; do seq 1 20000; sleep 0.05; done" // ~2 MB/s, a busy build log
		}
		must(b.Create("load", line))
		if strings.Contains(load, "watched") && !strings.Contains(load, "unwatched") {
			lv := watch(attachOK(b, "load"))
			go func() {
				for range lv.ch {
				}
			}()
			defer lv.s.Close()
		}
		defer b.Kill("load")
	}
	must(b.Create("echo", "stty raw -echo; exec cat"))
	defer b.Kill("echo")
	time.Sleep(200 * time.Millisecond)
	v := watch(attachOK(b, "echo"))
	defer v.s.Close()
	v.drain(300 * time.Millisecond)
	keys := "abcdefgijknopquvwxyz"
	var lat []float64
	errs := 0
	for i := -30; i < n; i++ {
		k := keys[(i+30)%len(keys) : (i+30)%len(keys)+1]
		t0 := time.Now()
		if _, err := v.s.Write([]byte(k)); err != nil {
			errs++
			continue
		}
		t1, err := v.waitFor(k, 2*time.Second)
		if err != nil {
			errs++
			v.drain(100 * time.Millisecond)
			continue
		}
		if i >= 0 {
			lat = append(lat, msSince(t0, t1))
		}
		time.Sleep(time.Millisecond)
	}
	r.put(test, b.Name(), summarize(lat, errs))
}

type throughput struct {
	Seconds        float64 // key that starts it → sentinel on the viewer's screen
	ViewerMB       float64 // bytes the viewer had to take
	MultiplexCPUMs float64 // CPU of the server (+ attach client) during the run
}

func testThroughput(b Backend, r results, label, workload string, reps int) {
	var secs, mbs, cpus []float64
	for i := 0; i < reps; i++ {
		must(b.Create("tp", "stty -echo; read -r _; "+workload+"; printf 'DO%sNE\\n' XY; exec sleep 3600"))
		time.Sleep(200 * time.Millisecond)
		s := attachOK(b, "tp")
		v := watch(s)
		v.drain(300 * time.Millisecond)
		pids := append(b.ServerPids(), s.Pids()...)
		cpu0, bytes0 := cpuMs(pids), v.bytes.Load()
		t0 := time.Now()
		_, _ = s.Write([]byte("\r"))
		t1, err := v.waitFor("DOXYNE", 3*time.Minute)
		cpu1 := cpuMs(pids)
		if err == nil {
			secs = append(secs, t1.Sub(t0).Seconds())
			mbs = append(mbs, float64(v.bytes.Load()-bytes0)/1e6)
			cpus = append(cpus, cpu1-cpu0)
		} else {
			fmt.Fprintln(os.Stderr, "   ", err)
		}
		s.Close()
		_ = b.Kill("tp")
		time.Sleep(300 * time.Millisecond)
	}
	if len(secs) == 0 {
		r.put("throughput: "+label, b.Name(), "failed")
		return
	}
	r.put("throughput: "+label, b.Name(), throughput{median(secs), median(mbs), median(cpus)})
}

type attachResult struct {
	FirstByte dist
	Painted   dist // until the last line of the screen is visible
	PaintKB   float64
}

// attach: a viewer joins a terminal that already has 5000 lines behind it.
func testAttach(b Backend, r results, n int, label string, attach func() (Stream, error)) {
	var first, painted, kb []float64
	errs := 0
	for i := 0; i < n; i++ {
		t0 := time.Now()
		s, err := attach()
		if err != nil {
			errs++
			continue
		}
		v := watch(s)
		t1, err := v.waitFor("ATTTCH", 5*time.Second)
		if err != nil {
			errs++
		} else {
			painted = append(painted, msSince(t0, t1))
			first = append(first, msSince(t0, time.Unix(0, v.first.Load())))
			time.Sleep(30 * time.Millisecond)
			kb = append(kb, float64(v.bytes.Load())/1024)
		}
		s.Close()
		time.Sleep(20 * time.Millisecond)
	}
	r.put("attach "+label, b.Name(), attachResult{summarize(first, 0), summarize(painted, errs), median(kb)})
}

func testCapture(r results, name string, n int, capture func() (string, error)) {
	var lat []float64
	errs := 0
	for i := 0; i < n; i++ {
		t0 := time.Now()
		out, err := capture()
		if err != nil || !strings.Contains(out, "ATTTCH") {
			errs++
			continue
		}
		lat = append(lat, msSince(t0, time.Now()))
	}
	r.put("screen read", name, summarize(lat, errs))
}

func testCreateKill(b Backend, r results, n int) {
	var create, kill []float64
	for i := 0; i < n; i++ {
		name := fmt.Sprintf("ck%d", i)
		t0 := time.Now()
		must(b.Create(name, "exec sleep 3600"))
		create = append(create, msSince(t0, time.Now()))
		time.Sleep(50 * time.Millisecond)
		t0 = time.Now()
		must(b.Kill(name))
		kill = append(kill, msSince(t0, time.Now()))
	}
	r.put("create", b.Name(), summarize(create, 0))
	r.put("kill", b.Name(), summarize(kill, 0))
}

type footprint struct {
	Terminals  int
	Processes  int
	PssMB      float64
	IdleCPUPct float64 // over 10 s, of one core
}

var footprintRuns = map[string]int{}

func testFootprint(b Backend, r results, count int) {
	footprintRuns[b.Name()+fmt.Sprint(count)]++
	label := fmt.Sprintf("footprint, %d idle shells", count)
	if footprintRuns[b.Name()+fmt.Sprint(count)] > 1 {
		label += ", after the heavy tests"
	}
	for i := 0; i < count; i++ {
		must(b.Create(fmt.Sprintf("fp%d", i), "exec bash --norc --noprofile -i"))
	}
	time.Sleep(3 * time.Second)
	pids := b.ServerPids()
	pss := 0
	for _, p := range pids {
		pss += pssKB(p)
	}
	c0 := cpuMs(pids)
	time.Sleep(10 * time.Second)
	c1 := cpuMs(pids)
	r.put(label, b.Name(),
		footprint{count, len(pids), float64(pss) / 1024, (c1 - c0) / 100})
	for i := 0; i < count; i++ {
		_ = b.Kill(fmt.Sprintf("fp%d", i))
	}
	time.Sleep(500 * time.Millisecond)
}

func attachOK(b Backend, name string) Stream {
	s, err := b.Attach(name, cols, rows)
	must(err)
	return s
}

func main() {
	hcBin := flag.String("hc", "", "herdr-core binary")
	dir := flag.String("dir", os.TempDir(), "scratch directory")
	out := flag.String("out", "results.json", "where to write the results")
	quick := flag.Bool("quick", false, "fewer iterations")
	only := flag.String("only", "", "comma-separated test groups")
	flag.Parse()
	for _, p := range []*string{dir, hcBin} {
		if abs, err := filepath.Abs(*p); err == nil {
			*p = abs
		}
	}

	n, reps := 1000, 3
	if *quick {
		n, reps = 100, 1
	}
	want := func(g string) bool { return *only == "" || strings.Contains(","+*only+",", ","+g+",") }

	backends := []Backend{newDirect(), newTmux(*dir), newHC(*hcBin, *dir+"/hc")}
	r := results{}
	meta := map[string]any{"started": time.Now().Format(time.RFC3339)}
	if out, err := exec.Command("tmux", "-V").Output(); err == nil {
		meta["tmux"] = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("nproc").Output(); err == nil {
		meta["cpus"] = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("uname", "-sr").Output(); err == nil {
		meta["kernel"] = strings.TrimSpace(string(out))
	}

	for _, b := range backends {
		fmt.Fprintf(os.Stderr, "== %s\n", b.Name())
		must(b.Setup())
		if want("footprint") {
			if _, isDirect := b.(*direct); !isDirect {
				testFootprint(b, r, 1)
				testFootprint(b, r, 50)
			}
		}
		if want("echo") {
			testEcho(b, r, n, "")
			testEcho(b, r, n/2, "(unwatched)")
			testEcho(b, r, n/2, "(watched)")
			testEcho(b, r, n/2, "(watched, ~2 MB/s)")
		}
		if want("throughput") {
			testThroughput(b, r, "seq 1..2M (14.9 MB, short lines)", "seq 1 2000000", reps)
			testThroughput(b, r, "base64 (20 MB, 120-col lines)", "head -c 15000000 /dev/urandom | base64 -w 120", reps)
		}
		if _, isDirect := b.(*direct); !isDirect {
			if want("attach") || want("capture") || want("restart") {
				must(b.Create("ap", "seq 1 5000; printf 'AT%sCH\\n' TT; exec sleep 3600"))
				time.Sleep(time.Second)
			}
			if want("attach") {
				testAttach(b, r, 50, "(screen)", func() (Stream, error) { return b.Attach("ap", cols, rows) })
				if h, ok := b.(*hcBackend); ok {
					testAttach(b, r, 50, "(+1000 lines of history)", func() (Stream, error) { return h.attach("ap", cols, rows, 1000) })
				}
			}
			if want("capture") {
				testCapture(r, b.Name(), 200, func() (string, error) { return b.Capture("ap") })
				if h, ok := b.(*hcBackend); ok {
					testCapture(r, h.Name()+" (CLI exec)", 200, func() (string, error) { return h.cli("read", "ap") })
				}
			}
			if want("create") {
				testCreateKill(b, r, 30)
			}
			if want("footprint") {
				// Same server, after the output-heavy tests above.
				testFootprint(b, r, 1)
			}
			if h, ok := b.(*hcBackend); ok && want("restart") {
				for _, mode := range []string{"update", "crash+kick", "crash"} {
					for i := 0; i < 3; i++ {
						testHCRestart(h, r, mode, i)
						time.Sleep(time.Second)
					}
				}
				testProbe(h, r)
			}
			if t, ok := b.(*tmuxBackend); ok && want("restart") {
				testProbeTmux(t, r)
			}
		}
		b.Teardown()
	}

	j, _ := json.MarshalIndent(map[string]any{"meta": meta, "results": r}, "", "  ")
	must(os.WriteFile(*out, j, 0o644))
	fmt.Fprintf(os.Stderr, "wrote %s\n", *out)
}

type restartResult struct {
	ServingAgainMs float64
	SamePid        bool
	ScreenKept     bool
}

// testHCRestart restarts herdr-core's server (what an update does) with a
// live terminal and times how long until the terminal is readable again.
// testHCRestart restarts herdr-core's server with a live terminal and times
// how long until that terminal is readable again. mode: "update" (hc server
// restart), "crash" (SIGKILL; the holder brings a core back on its own) or
// "crash+kick" (SIGKILL, then the client starts a core, as the runner could).
func testHCRestart(h *hcBackend, r results, mode string, rep int) {
	pidOf := func() float64 {
		res, err := h.ctl.call("terminal.get", map[string]any{"terminal": "ap"})
		if err != nil {
			return -1
		}
		var t struct{ Pid float64 }
		_ = json.Unmarshal(res, &t)
		return t.Pid
	}
	before := pidOf()
	h.ctl.conn.Close()
	t0 := time.Now()
	switch mode {
	case "update":
		if _, err := h.cli("server", "restart"); err != nil {
			r.put("core "+mode, h.Name(), err.Error())
			return
		}
	default:
		for _, pid := range procsMatching(h.bin, " serve") {
			_ = syscall.Kill(pid, syscall.SIGKILL)
		}
		if mode == "crash+kick" {
			time.Sleep(5 * time.Millisecond)
			_, _ = h.cli("ls") // any command starts a core when none answers
		}
	}
	var res restartResult
	for time.Since(t0) < 60*time.Second {
		c, err := net.Dial("unix", h.sock)
		if err == nil {
			h.ctl = &rpcConn{conn: c, br: bufio.NewReader(c)}
			if _, err := h.Capture("ap"); err == nil {
				res.ServingAgainMs = msSince(t0, time.Now())
				break
			}
			c.Close()
		}
		time.Sleep(5 * time.Millisecond)
	}
	if res.ServingAgainMs == 0 {
		r.put(fmt.Sprintf("core %s #%d", mode, rep+1), h.Name(), "not back within 60 s")
		c, err := dialRPC(h.sock)
		must(err)
		h.ctl = c
		return
	}
	for t := time.Now(); time.Since(t) < 2*time.Second; time.Sleep(50 * time.Millisecond) {
		if txt, err := h.Capture("ap"); err == nil && strings.Contains(txt, "ATTTCH") {
			res.ScreenKept = true
			break
		}
	}
	if !res.ScreenKept {
		raw, _ := h.ctl.call("terminal.read", map[string]any{"terminal": "ap"})
		fmt.Fprintf(os.Stderr, "    screen after %s: %.300q\n", mode, raw)
	}
	res.SamePid = before > 0 && pidOf() == before
	r.put(fmt.Sprintf("core %s #%d", mode, rep+1), h.Name(), res)
}

// probeLine asks the terminal whether it speaks OSC 7501, the way Claude
// Code does at start-up, with DA1 after it as the control every terminal
// answers, and writes what came back.
const probeLine = `stty raw -echo; printf '\033]7501;?\033\\\033[c'; ` +
	`timeout --foreground 1 cat > %s; exec sleep 3600`

func testProbe(h *hcBackend, r results) {
	out := h.dir + "/probe.out"
	_ = os.Remove(out)
	must(h.Create("probe", fmt.Sprintf(probeLine, out)))
	s := attachOK(h, "probe") // a viewer, so a display is there to answer for
	time.Sleep(2500 * time.Millisecond)
	s.Close()
	got, _ := os.ReadFile(out)
	got = []byte(fmt.Sprintf("%q", got))
	r.put("answers OSC 7501 probe", h.Name(), strings.Contains(string(got), "7501"))
	r.put("probe reply (od -c)", h.Name(), string(got))
	_ = h.Kill("probe")
}

func testProbeTmux(t *tmuxBackend, r results) {
	out := t.config + ".probe.out"
	_ = os.Remove(out)
	must(t.Create("probe", fmt.Sprintf(probeLine, out)))
	s := attachOK(t, "probe")
	time.Sleep(2500 * time.Millisecond)
	s.Close()
	got, _ := os.ReadFile(out)
	got = []byte(fmt.Sprintf("%q", got))
	r.put("answers OSC 7501 probe", t.Name(), strings.Contains(string(got), "7501"))
	r.put("probe reply (od -c)", t.Name(), string(got))
	_ = t.Kill("probe")
}
