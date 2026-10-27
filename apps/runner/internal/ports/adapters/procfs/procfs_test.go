package procfs

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Two lines of a real /proc/net/tcp6 and three of /proc/net/tcp: a listener
// on [::]:5173, an established connection, 127.0.0.1:3001 and *:22.
const tcp = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:0BB9 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41001 1 0000000000000000 100 0 0 10 0
   1: 00000000:0016 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 41002 1 0000000000000000 100 0 0 10 0
   2: 0100007F:0BB9 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 41003 1 0000000000000000 20 4 30 10 -1
`

const tcp6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000000000000:1435 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41004 1 0000000000000000 100 0 0 10 0
   1: 00000000000000000000000001000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41005 1 0000000000000000 100 0 0 10 0
`

func TestParseTableReadsListenersByInode(t *testing.T) {
	got := map[string]socket{}
	if err := parseTable(strings.NewReader(tcp), got); err != nil {
		t.Fatal(err)
	}
	if err := parseTable(strings.NewReader(tcp6), got); err != nil {
		t.Fatal(err)
	}
	want := map[string]socket{
		"41001": {addr: netip.MustParseAddr("127.0.0.1"), port: 3001},
		"41002": {addr: netip.MustParseAddr("0.0.0.0"), port: 22},
		"41004": {addr: netip.IPv6Unspecified(), port: 5173},
		"41005": {addr: netip.MustParseAddr("::1"), port: 8080},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d listeners %+v, want %d (the established connection left out)", len(got), got, len(want))
	}
	for inode, w := range want {
		if got[inode] != w {
			t.Errorf("inode %s: got %+v, want %+v", inode, got[inode], w)
		}
	}
}

// TestOfFindsTheSessionsOwnListenerOnly runs against the real /proc: a child
// process listens with one session's environment, and only that session sees
// its port.
func TestOfFindsTheSessionsOwnListenerOnly(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("procfs is Linux's")
	}
	cmd := exec.Command(os.Args[0], "-test.run=TestHelperListen")
	cmd.Env = append(os.Environ(), "PORTS_HELPER=1", "OPPENHEIMER_SESSION=session-a")
	out, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill(); _ = cmd.Wait() })
	line, err := bufio.NewReader(out).ReadString('\n')
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(strings.TrimSpace(line))
	if err != nil {
		t.Fatalf("helper said %q", line)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	mine, err := Listeners{}.Of(ctx, "session-a")
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, l := range mine {
		if l.Port == port && l.PID == cmd.Process.Pid {
			found = true
		}
	}
	if !found {
		t.Fatalf("session-a's listener on %d not found in %+v", port, mine)
	}
	theirs, err := Listeners{}.Of(ctx, "session-b")
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range theirs {
		if l.Port == port {
			t.Fatalf("session-b was given session-a's port: %+v", l)
		}
	}
}

// TestHelperListen is the child process of the test above, not a test.
func TestHelperListen(t *testing.T) {
	if os.Getenv("PORTS_HELPER") != "1" {
		t.Skip("helper process")
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(ln.Addr().(*net.TCPAddr).Port)
	time.Sleep(time.Minute)
}
