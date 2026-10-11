package main

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"

	"golang.org/x/sys/unix"
)

// newNetns makes a network namespace and pins it at path, so that later
// calls (and `netsim exec`) can enter it by that name. The thread that made
// it stays locked and dies with its goroutine: it is never handed back to the
// scheduler in the wrong namespace.
func newNetns(path string) error {
	errc := make(chan error, 1)
	go func() {
		runtime.LockOSThread()
		if err := unix.Unshare(unix.CLONE_NEWNET); err != nil {
			errc <- fmt.Errorf("unshare: %w", err)
			return
		}
		f, err := os.Create(path) //nolint:gosec // the state directory is the caller's
		if err != nil {
			errc <- err
			return
		}
		_ = f.Close()
		self := fmt.Sprintf("/proc/self/task/%d/ns/net", unix.Gettid())
		if err := unix.Mount(self, path, "", unix.MS_BIND, ""); err != nil {
			errc <- fmt.Errorf("pin %s: %w", path, err)
			return
		}
		errc <- nil
	}()
	return <-errc
}

func dropNetns(path string) {
	_ = unix.Unmount(path, unix.MNT_DETACH)
	_ = os.Remove(path)
}

// inNetns runs fn on a thread inside the namespace pinned at path. Sockets
// and devices fn makes belong to that namespace for good; the thread itself
// is discarded afterwards.
func inNetns(path string, fn func() error) error {
	errc := make(chan error, 1)
	go func() {
		runtime.LockOSThread()
		fd, err := unix.Open(path, unix.O_RDONLY|unix.O_CLOEXEC, 0)
		if err != nil {
			errc <- err
			return
		}
		defer func() { _ = unix.Close(fd) }()
		if err := unix.Setns(fd, unix.CLONE_NEWNET); err != nil {
			errc <- fmt.Errorf("setns %s: %w", path, err)
			return
		}
		errc <- fn()
	}()
	return <-errc
}

// openTun makes a TUN device carrying bare IP packets.
func openTun(name string) (int, error) {
	fd, err := unix.Open("/dev/net/tun", unix.O_RDWR|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	ifr, err := unix.NewIfreq(name)
	if err != nil {
		_ = unix.Close(fd)
		return -1, err
	}
	ifr.SetUint16(unix.IFF_TUN | unix.IFF_NO_PI)
	if err := unix.IoctlIfreq(fd, unix.TUNSETIFF, ifr); err != nil {
		_ = unix.Close(fd)
		return -1, fmt.Errorf("TUNSETIFF %s: %w", name, err)
	}
	return fd, nil
}

// configure gives an interface an IPv4 address and mask (nil leaves them) and
// brings it up.
func configure(name string, addr, mask net.IP) error {
	s, err := unix.Socket(unix.AF_INET, unix.SOCK_DGRAM|unix.SOCK_CLOEXEC, 0)
	if err != nil {
		return err
	}
	defer func() { _ = unix.Close(s) }()
	ifr, err := unix.NewIfreq(name)
	if err != nil {
		return err
	}
	if addr != nil {
		if err := ifr.SetInet4Addr(addr.To4()); err != nil {
			return err
		}
		if err := unix.IoctlIfreq(s, unix.SIOCSIFADDR, ifr); err != nil {
			return fmt.Errorf("address %s: %w", name, err)
		}
		if err := ifr.SetInet4Addr(mask.To4()); err != nil {
			return err
		}
		if err := unix.IoctlIfreq(s, unix.SIOCSIFNETMASK, ifr); err != nil {
			return fmt.Errorf("netmask %s: %w", name, err)
		}
	}
	if err := unix.IoctlIfreq(s, unix.SIOCGIFFLAGS, ifr); err != nil {
		return fmt.Errorf("flags %s: %w", name, err)
	}
	ifr.SetUint16(ifr.Uint16() | unix.IFF_UP | unix.IFF_RUNNING)
	if err := unix.IoctlIfreq(s, unix.SIOCSIFFLAGS, ifr); err != nil {
		return fmt.Errorf("up %s: %w", name, err)
	}
	return nil
}

// execIn replaces this process with argv inside the namespace at path.
func execIn(path string, argv []string) error {
	runtime.LockOSThread()
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}
	if err := unix.Setns(fd, unix.CLONE_NEWNET); err != nil {
		return fmt.Errorf("setns %s: %w", path, err)
	}
	_ = unix.Close(fd)
	bin, err := exec.LookPath(argv[0])
	if err != nil {
		return err
	}
	return unix.Exec(bin, argv, os.Environ())
}
