// Package procfs finds a session's listening sockets on Linux, from /proc:
// the kernel's socket tables give each listener's inode, a process's fd
// links say which inodes it holds, and its environment says which session
// it belongs to.
package procfs

import (
	"bufio"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"net/netip"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

// tcpListen is the state column's value for a listening socket.
const tcpListen = "0A"

// Listeners reads /proc.
type Listeners struct {
	// Root is the procfs mount; empty is /proc. A test points it at a fixture.
	Root string
}

var _ app.Listeners = Listeners{}

// Of is every listening socket held by a process whose environment names the
// session. Processes this account cannot read (another user's) are skipped:
// a session's processes are the runner's own account's.
func (p Listeners) Of(_ context.Context, sessionID string) ([]domain.Listener, error) {
	root := p.Root
	if root == "" {
		root = "/proc"
	}
	sockets := map[string]socket{}
	for _, table := range []string{"net/tcp", "net/tcp6"} {
		if err := readTable(filepath.Join(root, table), sockets); err != nil {
			return nil, err
		}
	}
	if len(sockets) == 0 {
		return nil, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var found []domain.Listener
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		dir := filepath.Join(root, entry.Name())
		inodes := socketInodes(dir)
		if len(inodes) == 0 {
			continue
		}
		var held []socket
		for _, inode := range inodes {
			if s, ok := sockets[inode]; ok {
				held = append(held, s)
			}
		}
		if len(held) == 0 {
			continue
		}
		environ, err := os.ReadFile(filepath.Join(dir, "environ")) //nolint:gosec // a /proc entry named by a pid
		if err != nil || !domain.OwnedBy(environ, sessionID) {
			continue
		}
		process := comm(dir)
		for _, s := range held {
			found = append(found, domain.Listener{Port: s.port, Addr: s.addr, Process: process, PID: pid})
		}
	}
	return found, nil
}

type socket struct {
	addr netip.Addr
	port int
}

// readTable adds the listening sockets of one /proc/net/tcp* table, by inode.
// A table that does not exist (no IPv6) is empty.
func readTable(path string, into map[string]socket) error {
	f, err := os.Open(path) //nolint:gosec // one of /proc/net's two tables
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	return parseTable(f, into)
}

// parseTable reads the kernel's format: a header, then per socket
// `sl local_address rem_address st … uid timeout inode …`, addresses as
// hex IP:port in host byte order per 32-bit word.
func parseTable(r io.Reader, into map[string]socket) error {
	scanner := bufio.NewScanner(r)
	first := true
	for scanner.Scan() {
		if first {
			first = false
			continue
		}
		fields := strings.Fields(scanner.Text())
		if len(fields) < 10 || fields[3] != tcpListen {
			continue
		}
		addr, port, err := parseAddr(fields[1])
		if err != nil {
			continue
		}
		into[fields[9]] = socket{addr: addr, port: port}
	}
	return scanner.Err()
}

func parseAddr(field string) (netip.Addr, int, error) {
	host, portHex, ok := strings.Cut(field, ":")
	if !ok {
		return netip.Addr{}, 0, fmt.Errorf("no port in %q", field)
	}
	port, err := strconv.ParseUint(portHex, 16, 16)
	if err != nil {
		return netip.Addr{}, 0, err
	}
	raw, err := hex.DecodeString(host)
	if err != nil || (len(raw) != 4 && len(raw) != 16) {
		return netip.Addr{}, 0, fmt.Errorf("bad address %q", host)
	}
	// Each 32-bit word is in the host's byte order, little-endian on every
	// machine the runner ships for.
	for i := 0; i < len(raw); i += 4 {
		raw[i], raw[i+1], raw[i+2], raw[i+3] = raw[i+3], raw[i+2], raw[i+1], raw[i]
	}
	addr, _ := netip.AddrFromSlice(raw)
	return addr.Unmap(), int(port), nil
}

// socketInodes is the inodes of the sockets a process holds open.
func socketInodes(dir string) []string {
	fds, err := os.ReadDir(filepath.Join(dir, "fd"))
	if err != nil {
		return nil
	}
	var inodes []string
	for _, fd := range fds {
		target, err := os.Readlink(filepath.Join(dir, "fd", fd.Name()))
		if err != nil {
			continue
		}
		if inode, ok := strings.CutPrefix(target, "socket:["); ok {
			inodes = append(inodes, strings.TrimSuffix(inode, "]"))
		}
	}
	return inodes
}

func comm(dir string) string {
	name, err := os.ReadFile(filepath.Join(dir, "comm")) //nolint:gosec // a /proc entry named by a pid
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(name))
}
