package link_test

import (
	"context"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

func refusalCounter(t *testing.T, url, fingerprint string) (*link.Client, *atomic.Int32) {
	t.Helper()
	var refused atomic.Int32
	c, err := link.New(link.Options{
		ControlPlaneURL: url,
		Token:           func(context.Context) (string, error) { return "token", nil },
		Fingerprint:     fingerprint,
		Handler:         &recorder{},
		Logger:          slog.New(slog.NewTextHandler(testWriter{t}, nil)),
		Ladder:          []time.Duration{10 * time.Millisecond},
		OnHelloRefused:  func() { refused.Add(1) },
	})
	if err != nil {
		t.Fatal(err)
	}
	return c, &refused
}

// A control plane that reads the hello and closes with 4400 refused this
// binary: the update loop is told, every time, so it can roll back.
func TestAHelloRefusedWith4400IsReportedOnEveryDial(t *testing.T) {
	cp := newControlPlane(t)
	cp.refuseHello = true
	c, refused := refusalCounter(t, cp.server.URL, cp.fingerprint)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)
	eventually(t, "three refusals reported", func() bool { return refused.Load() >= 3 })
}

// A link that comes up, an update_required hint and a control plane that is
// not there at all say nothing against this binary: none is reported.
func TestOnlyA4400RefusalIsReported(t *testing.T) {
	for name, setup := range map[string]func(*controlPlane){
		"welcome":         func(*controlPlane) {},
		"update required": func(cp *controlPlane) { cp.refuse = &link.Hint{Type: "hint", Kind: "update_required"} },
		"unreachable":     func(cp *controlPlane) { cp.server.Close() },
	} {
		t.Run(name, func(t *testing.T) {
			cp := newControlPlane(t)
			setup(cp)
			c, refused := refusalCounter(t, cp.server.URL, cp.fingerprint)
			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer cancel()
			go func() {
				for {
					select {
					case <-ctx.Done():
						return
					case <-cp.conns:
					case <-cp.hellos:
					}
				}
			}()
			_ = c.Run(ctx)
			if n := refused.Load(); n != 0 {
				t.Fatalf("%d refusals reported", n)
			}
		})
	}
}
