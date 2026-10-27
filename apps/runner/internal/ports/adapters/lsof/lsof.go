// Package lsof finds a session's listening sockets on macOS, which has no
// /proc: `lsof` lists the listeners with their processes, and `ps -E` shows
// a process's environment to its own account.
package lsof

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"net/netip"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/domain"
)

// timeout bounds each command; lsof walks every process's descriptors.
const timeout = 10 * time.Second

// Listeners runs lsof and ps.
type Listeners struct{}

var _ app.Listeners = Listeners{}

// Of is every listening TCP socket held by a process whose environment names
// the session.
func (Listeners) Of(ctx context.Context, sessionID string) ([]domain.Listener, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn").Output()
	if err != nil {
		// lsof exits 1 when nothing matched.
		var exit *exec.ExitError
		if errors.As(err, &exit) && exit.ExitCode() == 1 {
			return nil, nil
		}
		return nil, err
	}
	all := Parse(out)
	owned := map[int]bool{}
	var found []domain.Listener
	for _, l := range all {
		mine, seen := owned[l.PID]
		if !seen {
			mine = ownedBy(ctx, l.PID, sessionID)
			owned[l.PID] = mine
		}
		if mine {
			found = append(found, l)
		}
	}
	return found, nil
}

// Parse reads lsof's field output: `p<pid>`, `c<command>`, then an `n<addr>`
// per socket (`127.0.0.1:5173`, `*:3000`, `[::1]:5173`).
func Parse(out []byte) []domain.Listener {
	var (
		found   []domain.Listener
		pid     int
		command string
	)
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		value := line[1:]
		switch line[0] {
		case 'p':
			pid, _ = strconv.Atoi(value)
			command = ""
		case 'c':
			command = value
		case 'n':
			i := strings.LastIndex(value, ":")
			if i < 0 {
				continue
			}
			port, err := strconv.Atoi(value[i+1:])
			if err != nil {
				continue
			}
			host := strings.Trim(value[:i], "[]")
			var addr netip.Addr
			if host == "*" {
				addr = netip.IPv4Unspecified()
			} else if addr, err = netip.ParseAddr(host); err != nil {
				continue
			}
			found = append(found, domain.Listener{Port: port, Addr: addr, Process: command, PID: pid})
		}
	}
	return found
}

// ownedBy asks ps for the process's environment, which macOS shows after the
// command, space-separated, to the process's own account.
func ownedBy(ctx context.Context, pid int, sessionID string) bool {
	//nolint:gosec // fixed arguments, and a pid lsof reported as a number
	out, err := exec.CommandContext(ctx, "ps", "-E", "-ww", "-o", "command=", "-p", strconv.Itoa(pid)).Output()
	if err != nil {
		return false
	}
	want := domain.SessionEnv + "=" + sessionID
	for _, field := range strings.Fields(string(out)) {
		if field == want {
			return true
		}
	}
	return false
}
