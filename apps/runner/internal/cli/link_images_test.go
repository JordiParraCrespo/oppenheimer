package cli

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const pulledCommand = "0b6f3f7e-5a3c-4c8e-9a4f-2f1d8c9b7a61"

func pullHandler(t *testing.T, serve http.HandlerFunc) *linkHandler {
	t.Helper()
	server := httptest.NewServer(serve)
	t.Cleanup(server.Close)
	return &linkHandler{
		app:       &App{Version: "test"},
		identity:  pairdomain.Identity{ControlPlaneURL: server.URL},
		bootToken: func(context.Context) (string, error) { return "boot-jwt", nil },
	}
}

func TestPullImageAsksForTheParkedImageWithTheHostsAssertion(t *testing.T) {
	var path, auth string
	h := pullHandler(t, func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_, _ = w.Write([]byte("png-bytes"))
	})

	data, err := h.pullImage(context.Background(), pulledCommand)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "png-bytes" {
		t.Fatalf("data = %q", data)
	}
	if path != "/api/v1/hosts/self/images/"+pulledCommand || auth != "Bearer boot-jwt" {
		t.Fatalf("path = %q, auth = %q", path, auth)
	}
}

func TestPullImageReadsNoMoreThanTheCap(t *testing.T) {
	h := pullHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", sessionsdomain.ImageMaxBytes+1)))
	})

	if _, err := h.pullImage(context.Background(), pulledCommand); err == nil {
		t.Fatal("an image over the cap must be refused, not written")
	}
}

func TestPullImageTreatsAnyRefusalAsAFailure(t *testing.T) {
	h := pullHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "gone", http.StatusNotFound)
	})

	_, err := h.pullImage(context.Background(), pulledCommand)
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("err = %v, want the control plane's 404 named", err)
	}
}
