package direct

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"
)

// Both sides compute the fingerprint list from SDP; the browser's copy of
// this function (direct-handshake.ts) must give the same string for the same
// SDP, whatever the case and order of the lines.
func TestFingerprintsAreNormalisedSortedAndDeduplicated(t *testing.T) {
	sdp := "v=0\r\na=fingerprint:SHA-256 ab:cd\r\nm=application 9\r\na=fingerprint:sha-256 AB:CD\r\na=fingerprint:sha-1 01:02\r\n"
	if got, want := Fingerprints(sdp), "sha-1 01:02,sha-256 AB:CD"; got != want {
		t.Fatalf("Fingerprints = %q, want %q", got, want)
	}
	if Fingerprints("v=0\r\n") != "" {
		t.Fatal("an SDP with no fingerprint named one")
	}
}

// The transcript is pinned byte for byte: the browser signs nothing, but it
// rebuilds these bytes to check the signature, so any drift here is every
// direct path refused.
func TestTheTranscriptIsTheContextTheFingerprintsAndTheNonce(t *testing.T) {
	got := string(Transcript("sha-256 AA", "sha-256 BB", "bm9uY2U"))
	want := "oppenheimer/direct/v1/host-proof\noffer-fingerprints:sha-256 AA\nanswer-fingerprints:sha-256 BB\nnonce:bm9uY2U\n"
	if got != want {
		t.Fatalf("transcript = %q, want %q", got, want)
	}
}

func TestTheHandshakeSignsTheTranscriptThenWaitsForReady(t *testing.T) {
	pub, key, _ := ed25519.GenerateKey(rand.Reader)
	h := &handshake{
		prove:  func(tr []byte) ([]byte, []byte, error) { return pub, ed25519.Sign(key, tr), nil },
		offer:  "sha-256 AA",
		answer: "sha-256 BB",
	}
	nonce := base64.RawURLEncoding.EncodeToString(make([]byte, nonceBytes))
	reply, done, err := h.receive([]byte(`{"t":"hello","v":1,"nonce":"` + nonce + `"}`))
	if err != nil || done {
		t.Fatalf("hello: %v, done %v", err, done)
	}
	var proof handshakeMessage
	if err := json.Unmarshal(reply, &proof); err != nil || proof.T != msgProof {
		t.Fatalf("reply %s", reply)
	}
	sig, _ := base64.RawURLEncoding.DecodeString(proof.Sig)
	if !ed25519.Verify(pub, Transcript("sha-256 AA", "sha-256 BB", nonce), sig) {
		t.Fatal("the proof does not verify over the transcript")
	}
	if _, _, err := h.receive([]byte(`{"t":"hello","v":1,"nonce":"` + nonce + `"}`)); !errors.Is(err, ErrHandshake) {
		t.Fatalf("a second hello: %v, want ErrHandshake", err)
	}
	if _, done, err := h.receive([]byte(`{"t":"ready","v":1}`)); err != nil || !done {
		t.Fatalf("ready: %v, done %v", err, done)
	}
}

func TestTheHandshakeRefusesAShortNonceAndAnotherVersion(t *testing.T) {
	h := &handshake{prove: func([]byte) ([]byte, []byte, error) { return nil, nil, nil }}
	for _, raw := range []string{
		`{"t":"hello","v":1,"nonce":"c2hvcnQ"}`,
		`{"t":"hello","v":2,"nonce":"` + base64.RawURLEncoding.EncodeToString(make([]byte, nonceBytes)) + `"}`,
		`not json`,
	} {
		if _, _, err := h.receive([]byte(raw)); !errors.Is(err, ErrHandshake) {
			t.Fatalf("%s: %v, want ErrHandshake", raw, err)
		}
	}
}
