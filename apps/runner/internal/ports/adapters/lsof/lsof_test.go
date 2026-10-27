package lsof

import (
	"net/netip"
	"testing"
)

func TestParseReadsEveryListenerWithItsProcess(t *testing.T) {
	out := []byte("p501\ncnode\nn127.0.0.1:5173\nn[::1]:5173\np777\ncpostgres\nn*:5432\n")
	got := Parse(out)
	want := []struct {
		pid     int
		process string
		addr    netip.Addr
		port    int
	}{
		{501, "node", netip.MustParseAddr("127.0.0.1"), 5173},
		{501, "node", netip.MustParseAddr("::1"), 5173},
		{777, "postgres", netip.IPv4Unspecified(), 5432},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i, w := range want {
		g := got[i]
		if g.PID != w.pid || g.Process != w.process || g.Addr != w.addr || g.Port != w.port {
			t.Errorf("%d: got %+v, want %+v", i, g, w)
		}
	}
}
