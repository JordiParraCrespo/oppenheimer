package cli

import (
	"testing"

	desktopapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/desktop/app"
	devapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/direct"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	portsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/ports/app"
	tgapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/telegram/app"
	waapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/whatsapp/app"
)

// A hello naming more capabilities than the control plane takes is refused
// whole and the host never links: 0.1.24 went offline on every host with all
// its features on when whatsapp.react made 33 against a cap of 32. A host with
// every feature on stays well under the cap.
func TestTheHelloWithEveryFeatureOnFitsTheControlPlanesCap(t *testing.T) {
	h := everyFeatureOn()
	named := h.capabilities()
	if len(named)*2 > link.HelloCapabilitiesMax {
		t.Fatalf("a host with every feature on names %d capabilities; the control plane takes %d: "+
			"raise HELLO_CAPABILITIES_MAX in packages/shared before this runner ships",
			len(named), link.HelloCapabilitiesMax)
	}
	seen := map[string]bool{}
	for _, capability := range named {
		if seen[capability] {
			t.Fatalf("the hello names %q twice", capability)
		}
		seen[capability] = true
	}
}

// everyFeatureOn is a handler holding every optional service the hello names
// a capability for. capabilities() reads only whether each is there.
func everyFeatureOn() *linkHandler {
	return &linkHandler{
		direct:   new(direct.Answerer),
		devices:  new(devapp.Service),
		ports:    new(portsapp.Service),
		desktop:  new(desktopapp.Service),
		whatsapp: new(waapp.Service),
		telegram: new(tgapp.Service),
	}
}
