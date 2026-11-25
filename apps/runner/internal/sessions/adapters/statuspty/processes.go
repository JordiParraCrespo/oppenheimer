package statuspty

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Wrappers = (*Reports)(nil)

// reportFlag is what sits between the runner's binary and the report file
// on a wrapper's command line (Wrap).
const reportFlag = " pty --report "

// poll is how often End looks whether a hung-up wrapper is gone.
const poll = 100 * time.Millisecond

// process is one row of the process table.
type process struct {
	pid, ppid, pgid int
	args            string
}

// Running lists the wrappers alive on this host, from the process table.
// A process is one only when it runs as this account and its command line
// is `<runner> pty --report <file> --` with the file in this runner's own
// report directory, named after a session: nothing else on the host, the
// user's own tmux or another `claude` included, is ever listed.
func (r *Reports) Running(ctx context.Context) ([]app.Wrapper, error) {
	table, err := r.table(ctx)
	if err != nil {
		return nil, err
	}
	return r.wrappers(table), nil
}

// End stops one wrapper the way closing its pane would: its program's
// process group is hung up and given the grace period to save its
// conversation and exit. Whatever is left then, or when ctx ends first, is
// killed: the group, and the wrapper once it is still the one listed.
func (r *Reports) End(ctx context.Context, wrapper app.Wrapper) error {
	if wrapper.Group > 1 {
		_ = syscall.Kill(-wrapper.Group, syscall.SIGHUP)
	}
	if r.waitGone(ctx, wrapper, r.grace()) {
		return nil
	}
	// Looked up again so a pid the system handed to someone else meanwhile
	// is not signalled. The runner may be stopping: the kill still happens.
	table, err := r.table(context.WithoutCancel(ctx))
	if err != nil {
		return err
	}
	for _, p := range table {
		if wrapper.Group > 1 && p.pgid == wrapper.Group {
			_ = syscall.Kill(-wrapper.Group, syscall.SIGKILL)
			break
		}
	}
	for _, w := range r.wrappers(table) {
		if w.Pid == wrapper.Pid && w.SessionID == wrapper.SessionID {
			_ = syscall.Kill(w.Pid, syscall.SIGKILL)
		}
	}
	r.waitGone(context.WithoutCancel(ctx), wrapper, time.Second)
	return nil
}

func (r *Reports) grace() time.Duration {
	if r.opts.Grace > 0 {
		return r.opts.Grace
	}
	return DefaultGrace
}

// waitGone reports whether the wrapper and its program's group ended within
// limit.
func (r *Reports) waitGone(ctx context.Context, wrapper app.Wrapper, limit time.Duration) bool {
	deadline := time.NewTimer(limit)
	defer deadline.Stop()
	tick := time.NewTicker(poll)
	defer tick.Stop()
	for {
		if !alive(wrapper.Pid) && (wrapper.Group <= 1 || !groupAlive(wrapper.Group)) {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-deadline.C:
			return false
		case <-tick.C:
		}
	}
}

// wrappers picks this runner's wrappers out of the process table. A shell
// tmux ran the wrapper through carries the same words: only the innermost
// process that does is the wrapper. Its program is the child that leads a
// process group of its own (pty.Start).
func (r *Reports) wrappers(table []process) []app.Wrapper {
	sessions := map[int]string{}
	for _, p := range table {
		if id, ok := r.sessionOf(p.args); ok {
			sessions[p.pid] = id
		}
	}
	var out []app.Wrapper
	for _, p := range table {
		id, ok := sessions[p.pid]
		if !ok {
			continue
		}
		wrapper := app.Wrapper{SessionID: id, Pid: p.pid}
		inner := false
		for _, c := range table {
			if c.ppid != p.pid {
				continue
			}
			if sessions[c.pid] == id {
				inner = true
			}
			if c.pgid == c.pid && c.pgid != p.pgid {
				wrapper.Group = c.pgid
			}
		}
		if !inner {
			out = append(out, wrapper)
		}
	}
	return out
}

// sessionOf reads the session a wrapper's command line names, when it names
// a report file in this runner's directory.
func (r *Reports) sessionOf(args string) (string, bool) {
	if r.opts.Dir == "" {
		return "", false
	}
	_, rest, ok := strings.Cut(args, reportFlag)
	if !ok {
		return "", false
	}
	path, _, ok := strings.Cut(rest, " --")
	if !ok || filepath.Dir(path) != filepath.Clean(r.opts.Dir) {
		return "", false
	}
	id, ok := strings.CutSuffix(filepath.Base(path), ".json")
	if !ok || !sessionFileName.MatchString(id) {
		return "", false
	}
	return id, true
}

// table reads this account's processes. `ps -A -o` with these keywords
// reads the same on macOS and on procps (Debian, Ubuntu); -ww keeps a long
// command line whole.
func (r *Reports) table(ctx context.Context) ([]process, error) {
	res, err := execx.Run(ctx, execx.Spec{
		Name: "ps", Args: []string{"-A", "-ww", "-o", "uid=", "-o", "pid=", "-o", "ppid=", "-o", "pgid=", "-o", "args="},
		Timeout: 10 * time.Second, Output: execx.Stdout,
	})
	if err != nil {
		return nil, fmt.Errorf("list processes: %w", err)
	}
	return parseTable(res.Out, os.Getuid()), nil
}

// parseTable reads ps output, keeping the processes of uid. A line it
// cannot read is skipped.
func parseTable(out string, uid int) []process {
	var table []process
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		var nums [4]int
		ok := true
		for i := range nums {
			n, err := strconv.Atoi(fields[i])
			if err != nil {
				ok = false
				break
			}
			nums[i] = n
		}
		if !ok || nums[0] != uid {
			continue
		}
		// args keeps its own spacing: everything after the fourth number.
		rest := line
		for range 4 {
			rest = strings.TrimLeft(rest, " \t")
			rest = rest[strings.IndexAny(rest, " \t"):]
		}
		table = append(table, process{pid: nums[1], ppid: nums[2], pgid: nums[3], args: strings.TrimLeft(rest, " \t")})
	}
	return table
}

// groupAlive reports whether any process is left in a process group.
func groupAlive(group int) bool {
	err := syscall.Kill(-group, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}
