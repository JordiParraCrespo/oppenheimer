package whatsmeow

import (
	"testing"

	"go.mau.fi/whatsmeow/store"
)

// The handshake has to carry the version WhatsApp Web serves today. A
// whatsmeow whose SetWAVersion changed only the build hash left the
// compiled-in AppVersion in the payload, and WhatsApp refused pairing with
// err-client-outdated.
func TestAnnounceVersionReachesTheHandshake(t *testing.T) {
	before := store.GetWAVersion()
	t.Cleanup(func() { announceVersion(before) })

	want := store.WAVersionContainer{2, 3000, before[2] + 1}
	if !announceVersion(want) {
		t.Fatal("a new version reads as unchanged")
	}
	if announceVersion(want) {
		t.Fatal("the same version reads as changed, so an outdated client would reconnect in a loop")
	}
	if got := store.GetWAVersion(); got != want {
		t.Fatalf("whatsmeow's version is %s, want %s", got, want)
	}

	got := store.BaseClientPayload.UserAgent.AppVersion
	if got.GetPrimary() != want[0] || got.GetSecondary() != want[1] || got.GetTertiary() != want[2] {
		t.Fatalf("handshake announces %d.%d.%d, want %s", got.GetPrimary(), got.GetSecondary(), got.GetTertiary(), want)
	}
}
