package direct

// The host proof (product/versions/mvp/31-peer-to-peer-and-the-host-proof.md):
// the first exchange on every data channel, before a PTY byte crosses it.
//
// DTLS already encrypts the channel end to end, but each end learns the other
// end's certificate fingerprint from SDP the control plane carried. A control
// plane that rewrote both fingerprints could sit in the middle of two DTLS
// sessions and read every keystroke. The proof closes that: the host signs
// both fingerprints, as it saw them, with the Ed25519 key it generated at
// pairing and never sent anywhere, over a nonce the browser chose. The
// browser checks the signature, that the fingerprints are the ones its own
// peer connection used, and that the key is the one it pinned for the host.
// A man in the middle cannot produce a signature over its own fingerprints.
//
//	browser ── hello {nonce} ──────────────▶ host
//	browser ◀─ proof {key, sig(transcript)} ─ host
//	browser ── ready ──────────────────────▶ host   (bytes flow after this)

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

// ProofVersion is the handshake's version, in every message and the transcript.
const ProofVersion = 1

// ProofContext begins every transcript the host signs. It is what keeps a
// proof from being anything else the host key signs (a boot token's JWS
// input begins with base64, never with this).
const ProofContext = "oppenheimer/direct/v1/host-proof"

// nonceBytes is the size of the browser's nonce.
const nonceBytes = 32

// Handshake messages: JSON text messages on the channel, binary being PTY
// bytes only.
const (
	msgHello = "hello"
	msgProof = "proof"
	msgReady = "ready"
)

// Prover signs a proof transcript with the host key and returns the public
// half with the signature. The key itself never reaches this package.
type Prover func(transcript []byte) (publicKey, signature []byte, err error)

// ErrHandshake is a browser that did not follow the handshake: the channel is
// closed and the attachment stays on the link.
var ErrHandshake = errors.New("direct: handshake")

type handshakeMessage struct {
	T     string `json:"t"`
	V     int    `json:"v"`
	Nonce string `json:"nonce,omitempty"`
	Key   string `json:"key,omitempty"`
	Sig   string `json:"sig,omitempty"`
}

// Fingerprints is every DTLS fingerprint an SDP names (`a=fingerprint:`),
// normalised to "<algorithm lowercase> <HEX UPPERCASE>", de-duplicated,
// sorted and joined with commas. The browser computes the same string from
// the same SDP, which is what lets both sides sign and check one transcript.
func Fingerprints(sdp string) string {
	seen := map[string]bool{}
	for _, line := range strings.Split(sdp, "\n") {
		line = strings.TrimSpace(line)
		rest, ok := strings.CutPrefix(line, "a=fingerprint:")
		if !ok {
			continue
		}
		fields := strings.Fields(rest)
		if len(fields) != 2 {
			continue
		}
		seen[strings.ToLower(fields[0])+" "+strings.ToUpper(fields[1])] = true
	}
	out := make([]string, 0, len(seen))
	for fp := range seen {
		out = append(out, fp)
	}
	sort.Strings(out)
	return strings.Join(out, ",")
}

// Transcript is the bytes the host signs: the context, the offer's and the
// answer's fingerprints, and the browser's nonce, one per line.
func Transcript(offerFingerprints, answerFingerprints, nonce string) []byte {
	return []byte(ProofContext + "\n" +
		"offer-fingerprints:" + offerFingerprints + "\n" +
		"answer-fingerprints:" + answerFingerprints + "\n" +
		"nonce:" + nonce + "\n")
}

// handshake is one channel's side of the exchange. Not safe for concurrent
// use: pion delivers a channel's messages one at a time.
type handshake struct {
	prove  Prover
	offer  string
	answer string
	proved bool
	ready  bool
}

// receive takes one text message and returns the reply to send, if any. done
// is true once the browser said ready: bytes may flow.
func (h *handshake) receive(raw []byte) (reply []byte, done bool, err error) {
	var m handshakeMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, false, fmt.Errorf("%w: not a handshake message", ErrHandshake)
	}
	if m.V != ProofVersion {
		return nil, false, fmt.Errorf("%w: version %d", ErrHandshake, m.V)
	}
	switch {
	case m.T == msgHello && !h.proved:
		nonce, err := base64.RawURLEncoding.DecodeString(m.Nonce)
		if err != nil || len(nonce) != nonceBytes {
			return nil, false, fmt.Errorf("%w: the nonce is not %d bytes", ErrHandshake, nonceBytes)
		}
		pub, sig, err := h.prove(Transcript(h.offer, h.answer, m.Nonce))
		if err != nil {
			return nil, false, fmt.Errorf("direct: sign the host proof: %w", err)
		}
		h.proved = true
		reply, err := json.Marshal(handshakeMessage{
			T: msgProof, V: ProofVersion,
			Key: base64.RawURLEncoding.EncodeToString(pub),
			Sig: base64.RawURLEncoding.EncodeToString(sig),
		})
		return reply, false, err
	case m.T == msgReady && h.proved && !h.ready:
		h.ready = true
		return nil, true, nil
	default:
		return nil, false, fmt.Errorf("%w: %q out of turn", ErrHandshake, m.T)
	}
}
