package controlplane_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/adapters/controlplane"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// The two paths and the credential are the wire (01-protocol.md,
// 03-control-plane.md). They are pinned here because a typo in either is a 404
// or a 401 nobody sees until a real host pairs.

type recorded struct {
	method string
	path   string
	header http.Header
	body   []byte
}

func serve(t *testing.T, status int, response any) (*controlplane.Client, string, *recorded) {
	t.Helper()
	seen := &recorded{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen.method, seen.path, seen.header, seen.body = r.Method, r.URL.Path, r.Header.Clone(), body
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if response != nil {
			_ = json.NewEncoder(w).Encode(response)
		}
	}))
	t.Cleanup(server.Close)
	return controlplane.New(controlplane.Options{HTTP: server.Client()}), server.URL, seen
}

func TestRegisterPostsUnderTheApiV1Prefix(t *testing.T) {
	client, baseURL, seen := serve(t, http.StatusCreated, app.RegisterResponse{
		HostID: "host_01HZ", Fingerprint: "abc", Channel: "stable",
	})

	resp, err := client.Register(context.Background(), baseURL, app.RegisterRequest{
		Token: "opr_reg_0123456789abcdef0123", Name: "mac-studio",
		PublicKey: "key", Facts: json.RawMessage(`{"platform":"macos"}`),
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	if seen.method != http.MethodPost || seen.path != "/api/v1/hosts/register" {
		t.Fatalf("%s %s, want POST /api/v1/hosts/register", seen.method, seen.path)
	}
	if resp.HostID != "host_01HZ" {
		t.Fatalf("response = %+v", resp)
	}
	// The request shape is what the API is being written to.
	var sent map[string]any
	if err := json.Unmarshal(seen.body, &sent); err != nil {
		t.Fatalf("request body: %v", err)
	}
	for _, field := range []string{"token", "name", "publicKey", "facts"} {
		if _, ok := sent[field]; !ok {
			t.Fatalf("request body %s is missing %q", seen.body, field)
		}
	}
}

func TestRevokeDeletesHostsSelfWithTheBootJWT(t *testing.T) {
	client, baseURL, seen := serve(t, http.StatusNoContent, nil)

	if err := client.Revoke(context.Background(), baseURL, "the.boot.jwt"); err != nil {
		t.Fatalf("revoke: %v", err)
	}

	if seen.method != http.MethodDelete || seen.path != "/api/v1/hosts/self" {
		t.Fatalf("%s %s, want DELETE /api/v1/hosts/self", seen.method, seen.path)
	}
	if got := seen.header.Get("Authorization"); got != "Bearer the.boot.jwt" {
		t.Fatalf("Authorization = %q, want the boot JWT as the bearer", got)
	}
}

func TestRevokeTreatsA404AsAlreadyGone(t *testing.T) {
	client, baseURL, _ := serve(t, http.StatusNotFound, nil)

	if err := client.Revoke(context.Background(), baseURL, "the.boot.jwt"); err != nil {
		t.Fatalf("a host the control plane no longer knows is the outcome uninstall asked for: %v", err)
	}
}

func TestRevokeReportsAnythingElse(t *testing.T) {
	client, baseURL, _ := serve(t, http.StatusUnauthorized, nil)

	err := client.Revoke(context.Background(), baseURL, "the.boot.jwt")

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_003" {
		t.Fatalf("err = %v, want PAIR_003", err)
	}
}

func TestRegisterKeepsTheProblemDetailTheControlPlaneSent(t *testing.T) {
	client, baseURL, _ := serve(t, http.StatusUnauthorized, map[string]string{
		"title":  "The pairing token was rejected",
		"detail": "that token was already redeemed",
	})

	_, err := client.Register(context.Background(), baseURL, app.RegisterRequest{Token: "t"})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_003" {
		t.Fatalf("err = %v, want PAIR_003", err)
	}
	if prob.Detail != "that token was already redeemed" {
		t.Fatalf("detail = %q, want the control plane's own sentence", prob.Detail)
	}
}

func TestRegisterReportsAnUnreachableControlPlane(t *testing.T) {
	client := controlplane.New(controlplane.Options{})

	_, err := client.Register(context.Background(), "https://127.0.0.1:1", app.RegisterRequest{Token: "t"})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_006" {
		t.Fatalf("err = %v, want PAIR_006", err)
	}
}

func TestRevokeRefusesACrossOriginRedirectAndCarriesNoCredentialToIt(t *testing.T) {
	elsewhere := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("the redirect target was called with Authorization %q", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(elsewhere.Close)
	controlPlane := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, elsewhere.URL+"/api/v1/hosts/self", http.StatusTemporaryRedirect)
	}))
	t.Cleanup(controlPlane.Close)
	client := controlplane.New(controlplane.Options{HTTP: controlPlane.Client()})

	err := client.Revoke(context.Background(), controlPlane.URL, "the.boot.jwt")

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_006" {
		t.Fatalf("err = %v, want PAIR_006 for a redirect off the control plane", err)
	}
}

func TestRevokeFollowsASameOriginRedirect(t *testing.T) {
	var seen []string
	controlPlane := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.URL.Path+" "+r.Header.Get("Authorization"))
		if r.URL.Path == "/api/v1/hosts/self" {
			http.Redirect(w, r, "/api/v1/hosts/self/", http.StatusTemporaryRedirect)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(controlPlane.Close)
	client := controlplane.New(controlplane.Options{HTTP: controlPlane.Client()})

	if err := client.Revoke(context.Background(), controlPlane.URL, "the.boot.jwt"); err != nil {
		t.Fatalf("a redirect within the control plane is ordinary: %v", err)
	}
	if len(seen) != 2 || seen[1] != "/api/v1/hosts/self/ Bearer the.boot.jwt" {
		t.Fatalf("requests = %v", seen)
	}
}

func TestRegisterReportsAThrottleAsRateLimitedNotAsARejectedToken(t *testing.T) {
	client, baseURL, _ := serve(t, http.StatusTooManyRequests, nil)

	_, err := client.Register(context.Background(), baseURL, app.RegisterRequest{
		Token: "opr_reg_0123456789abcdef0123", Name: "mac-studio", PublicKey: "key",
	})

	// A 429 is the throttle answering before the token was looked at, so the
	// person must be told to wait, not to mint a new token.
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "PAIR_007" {
		t.Fatalf("err = %v, want PAIR_007", err)
	}
}
