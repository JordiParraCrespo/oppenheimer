package domain

import (
	"net/netip"
	"testing"
)

func TestOwnedByMatchesTheWholeEntryOnly(t *testing.T) {
	environ := []byte("HOME=/home/a\x00OPPENHEIMER_SESSION=abc\x00PATH=/bin\x00")
	if !OwnedBy(environ, "abc") {
		t.Fatal("the session's own process was not recognised")
	}
	// A prefix of another session's id is not that session.
	if OwnedBy(environ, "ab") || OwnedBy(environ, "abcd") {
		t.Fatal("another session's process was taken for this one")
	}
	if OwnedBy([]byte("X=OPPENHEIMER_SESSION=abc\x00"), "abc") {
		t.Fatal("a value that merely contains the variable was taken for it")
	}
}

func TestDedupeKeepsReachablePortsOncePreferringIPv4Loopback(t *testing.T) {
	v6any := netip.IPv6Unspecified()
	got := Dedupe([]Listener{
		{Port: 5173, Addr: v6any},
		{Port: 5173, Addr: netip.MustParseAddr("127.0.0.1")},
		{Port: 22, Addr: netip.IPv4Unspecified()},               // below MinPort
		{Port: 8080, Addr: netip.MustParseAddr("192.168.1.20")}, // one LAN interface
		{Port: 3001, Addr: netip.MustParseAddr("::1")},
	})
	if len(got) != 2 || got[0].Port != 3001 || got[1].Port != 5173 {
		t.Fatalf("got %+v, want 3001 and 5173 in order", got)
	}
	if got[1].Addr != netip.MustParseAddr("127.0.0.1") {
		t.Fatalf("5173 kept %s, want the IPv4 loopback", got[1].Addr)
	}
}

func TestDialAddrOfAWildcardListenerIsTheLoopbackOfItsFamily(t *testing.T) {
	cases := map[netip.Addr]string{
		netip.IPv4Unspecified():          "127.0.0.1:5173",
		netip.IPv6Unspecified():          "[::1]:5173",
		netip.MustParseAddr("::1"):       "[::1]:5173",
		netip.MustParseAddr("127.0.0.1"): "127.0.0.1:5173",
	}
	for addr, want := range cases {
		if got := (Listener{Port: 5173, Addr: addr}).DialAddr().String(); got != want {
			t.Errorf("%s: dial %s, want %s", addr, got, want)
		}
	}
}
