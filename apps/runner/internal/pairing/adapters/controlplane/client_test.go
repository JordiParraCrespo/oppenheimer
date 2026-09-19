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

// The two paths and the one header are the contract with the API
// (product/versions/mvp/10-api-modules-and-data-model.md, and R1 in
// product/versions/mvp/11-api-implementation-plan.md). They are pinned here
// because a typo in either is a 404 or a 401 nobody sees until a real host
// pairs.

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

func TestRevokeDeletesHostsSelfWithTheAssertionHeader(t *testing.T) {
	client, baseURL, seen := serve(t, http.StatusNoContent, nil)

	if err := client.Revoke(context.Background(), baseURL, "the.boot.jwt"); err != nil {
		t.Fatalf("revoke: %v", err)
	}

	if seen.method != http.MethodDelete || seen.path != "/api/v1/hosts/self" {
		t.Fatalf("%s %s, want DELETE /api/v1/hosts/self", seen.method, seen.path)
	}
	if got := seen.header.Get("X-Oppenheimer-Host-Assertion"); got != "the.boot.jwt" {
		t.Fatalf("assertion header = %q", got)
	}
	// The API's global scopes guard rejects any bearer it does not recognise,
	// so the assertion must never travel as one.
	if got := seen.header.Get("Authorization"); got != "" {
		t.Fatalf("Authorization = %q, want the assertion header instead", got)
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
