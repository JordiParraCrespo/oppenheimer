package app_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/file"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/memory"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/token"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

const validToken = "opr_reg_0123456789abcdef0123"

func newService(t *testing.T) (*app.Service, *file.Store, *memory.ControlPlane) {
	t.Helper()
	store := file.New(t.TempDir())
	cp := memory.New()
	return app.New(app.Options{Store: store, ControlPlane: cp, Signer: token.New()}), store, cp
}

func register(t *testing.T, svc *app.Service) domain.Identity {
	t.Helper()
	identity, err := svc.Register(context.Background(), app.RegisterInput{
		Token:           validToken,
		ControlPlaneURL: "https://app.oppenheimer.dev",
		Name:            "mac-studio",
		Facts:           json.RawMessage(`{"platform":"macos"}`),
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	return identity
}

func TestRegisterStoresTheIdentityAndPinsTheFingerprint(t *testing.T) {
	svc, store, cp := newService(t)

	identity := register(t, svc)

	if identity.HostID != "host_01HZ" || identity.Fingerprint == "" {
		t.Fatalf("identity = %+v", identity)
	}
	if identity.Channel != domain.ChannelStable {
		t.Fatalf("channel = %q, want the default stable", identity.Channel)
	}
	if len(cp.Requests) != 1 || cp.Requests[0].Token != validToken {
		t.Fatalf("requests = %+v", cp.Requests)
	}
	// The public key goes to the control plane; the private half never does.
	if cp.Requests[0].PublicKey == "" || strings.Contains(string(cp.Requests[0].Facts), "PRIVATE") {
		t.Fatalf("request = %+v", cp.Requests[0])
	}
	if _, _, err := store.Load(); err != nil {
		t.Fatalf("load after register: %v", err)
	}
}

func TestRegisterWritesTheKey0600AndNeverStoresTheToken(t *testing.T) {
	svc, store, _ := newService(t)

	register(t, svc)

	info, err := os.Stat(store.KeyPath())
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("host.key is %#o, want 0600", perm)
	}
	config, err := os.ReadFile(store.ConfigPath())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(config), validToken) {
		t.Fatal("the registration token must never be written to disk")
	}
	if info, err := os.Stat(store.ConfigPath()); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("config.json is %v, want 0600", info.Mode().Perm())
	}
}

func TestRegisterRefusesASecondPairingWithoutForce(t *testing.T) {
	svc, _, _ := newService(t)
	register(t, svc)

	_, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "https://app.oppenheimer.dev",
	})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_002" {
		t.Fatalf("err = %v, want PAIR_002", err)
	}
}

func TestRegisterMovesAHostWithForce(t *testing.T) {
	svc, _, cp := newService(t)
	register(t, svc)
	cp.Response.HostID = "host_02AB"

	identity, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "https://app.oppenheimer.dev", Force: true,
	})
	if err != nil {
		t.Fatalf("force register: %v", err)
	}
	if identity.HostID != "host_02AB" {
		t.Fatalf("host id = %q", identity.HostID)
	}
}

func TestMarkRevokedKeepsTheFirstTimeAndLetsTheHostPairAgainWithoutForce(t *testing.T) {
	svc, _, cp := newService(t)
	register(t, svc)

	first, err := svc.MarkRevoked()
	if err != nil {
		t.Fatalf("mark revoked: %v", err)
	}
	if !first.Revoked() {
		t.Fatal("identity is not revoked")
	}
	again, err := svc.MarkRevoked()
	if err != nil {
		t.Fatalf("mark revoked again: %v", err)
	}
	if !again.RevokedAt.Equal(*first.RevokedAt) {
		t.Fatalf("revokedAt moved from %v to %v", first.RevokedAt, again.RevokedAt)
	}

	// An unpaired machine is paired again the ordinary way: no --force, and
	// the fresh identity is not revoked.
	cp.Response.HostID = "host_02AB"
	identity, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "https://app.oppenheimer.dev",
	})
	if err != nil {
		t.Fatalf("register after revocation: %v", err)
	}
	if identity.HostID != "host_02AB" || identity.Revoked() {
		t.Fatalf("identity = %+v", identity)
	}
}

func TestRegisterRejectsSomethingThatIsNotARegistrationToken(t *testing.T) {
	svc, _, _ := newService(t)

	_, err := svc.Register(context.Background(), app.RegisterInput{
		Token: "sk-live-not-a-registration-token", ControlPlaneURL: "https://app.oppenheimer.dev",
	})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_003" {
		t.Fatalf("err = %v, want PAIR_003", err)
	}
}

func TestRegisterRefusesAPlaintextControlPlane(t *testing.T) {
	svc, _, _ := newService(t)

	_, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "http://app.oppenheimer.dev",
	})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_005" {
		t.Fatalf("err = %v, want PAIR_005 for a plaintext control plane", err)
	}
}

func TestRegisterAllowsLoopbackOverPlainHTTPForDevelopment(t *testing.T) {
	svc, _, _ := newService(t)

	if _, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "http://localhost:3005",
	}); err != nil {
		t.Fatalf("register against a local control plane: %v", err)
	}
}

func TestIdentityOnAnUnpairedHostSaysHowToPairIt(t *testing.T) {
	svc, _, _ := newService(t)

	_, err := svc.Identity()

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_001" {
		t.Fatalf("err = %v, want PAIR_001", err)
	}
	if !strings.Contains(prob.Detail, "Add host") {
		t.Fatalf("detail = %q, want it to say where to get a token", prob.Detail)
	}
}

func TestBootTokenIsSignedByTheHostKeyAndExpires(t *testing.T) {
	svc, store, _ := newService(t)
	identity := register(t, svc)

	raw, err := svc.BootToken(context.Background())
	if err != nil {
		t.Fatalf("boot token: %v", err)
	}

	_, key, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := jwt.Parse(raw, func(*jwt.Token) (any, error) { return key.Public(), nil },
		jwt.WithValidMethods([]string{"EdDSA"}), jwt.WithAudience(identity.ControlPlaneURL))
	if err != nil {
		t.Fatalf("verify with the host public key: %v", err)
	}
	subject, err := parsed.Claims.GetSubject()
	if err != nil || subject != identity.HostID {
		t.Fatalf("subject = %q, want %q", subject, identity.HostID)
	}
	exp, err := parsed.Claims.GetExpirationTime()
	if err != nil || exp == nil {
		t.Fatalf("a boot token must expire: %v", err)
	}
	if id, _ := parsed.Claims.(jwt.MapClaims)["jti"].(string); id == "" {
		t.Fatal("a boot token must carry a jti the control plane can replay-check")
	}
}

func TestLoadRefusesAKeyOtherAccountsCanRead(t *testing.T) {
	svc, store, _ := newService(t)
	register(t, svc)
	if err := os.Chmod(store.KeyPath(), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := svc.Identity()

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_004" {
		t.Fatalf("err = %v, want PAIR_004 for a world-readable key", err)
	}
}

func TestSetChannelAndPinPersist(t *testing.T) {
	svc, store, _ := newService(t)
	register(t, svc)

	if _, err := svc.SetChannel(domain.ChannelBeta); err != nil {
		t.Fatal(err)
	}
	identity, err := svc.SetPin("1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if !identity.Pinned() {
		t.Fatal("a pinned host reports itself pinned")
	}

	reloaded, _, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Channel != domain.ChannelBeta || reloaded.PinnedVersion != "1.4.0" {
		t.Fatalf("reloaded = %+v", reloaded)
	}
}

func TestUnregisterRevokesWithTheHostAssertionAndErasesTheIdentity(t *testing.T) {
	svc, store, cp := newService(t)
	identity := register(t, svc)
	_, key, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}

	if revoked, err := svc.Unregister(context.Background()); err != nil || !revoked {
		t.Fatalf("unregister: revoked=%v err=%v", revoked, err)
	}
	if len(cp.Revoked) != 1 {
		t.Fatalf("revoked = %v, want exactly one call", cp.Revoked)
	}
	// Uninstall authenticates with the boot assertion, and the host names
	// itself by that token's subject rather than by an id in the path.
	parsed, err := jwt.Parse(cp.Revoked[0], func(*jwt.Token) (any, error) { return key.Public(), nil },
		jwt.WithValidMethods([]string{"EdDSA"}), jwt.WithAudience(identity.ControlPlaneURL))
	if err != nil {
		t.Fatalf("the revoke call must carry the host assertion: %v", err)
	}
	if subject, err := parsed.Claims.GetSubject(); err != nil || subject != identity.HostID {
		t.Fatalf("assertion subject = %q, want %q", subject, identity.HostID)
	}
	if _, err := os.Stat(store.KeyPath()); !os.IsNotExist(err) {
		t.Fatal("the host key must be gone after unregister")
	}
	if _, err := svc.Identity(); err == nil {
		t.Fatal("the host must read as unpaired after unregister")
	}
}

func TestUnregisterSaysSoWhenTheControlPlaneDidNotHear(t *testing.T) {
	svc, store, cp := newService(t)
	register(t, svc)
	cp.RevokeErr = errors.New("connection refused")

	revoked, err := svc.Unregister(context.Background())
	if err != nil {
		t.Fatalf("unregister: %v", err)
	}
	// The local half still happens — the user asked for it — but the caller
	// is told the control plane still trusts this key.
	if revoked {
		t.Fatal("revoked = true for a control plane that was never reached")
	}
	if _, err := os.Stat(store.KeyPath()); !os.IsNotExist(err) {
		t.Fatal("the host key must be gone after unregister")
	}
}

func TestSaveIsAtomicEnoughToLeaveNoStrayFiles(t *testing.T) {
	svc, store, _ := newService(t)
	register(t, svc)

	entries, err := os.ReadDir(filepath.Dir(store.ConfigPath()))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			t.Fatalf("temp file %q survived the write", e.Name())
		}
	}
}

func TestAChosenWorkspacesDirectorySurvivesARepair(t *testing.T) {
	svc, _, _ := newService(t)
	register(t, svc)
	if _, err := svc.SetWorkspaces("/srv/code"); err != nil {
		t.Fatal(err)
	}

	identity, err := svc.Register(context.Background(), app.RegisterInput{
		Token: validToken, ControlPlaneURL: "https://app.oppenheimer.dev", Force: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	// Where this machine keeps code is the machine's setting, not the pairing's.
	if identity.WorkspacesPath != "/srv/code" {
		t.Fatalf("workspacesPath = %q after re-pairing", identity.WorkspacesPath)
	}
}
