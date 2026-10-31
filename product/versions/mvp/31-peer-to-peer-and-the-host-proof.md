# 31 — Peer to peer first, and the host proof

Asked for on 2026-10-31: "I would like to make it as much p2p as possible
in order to improve the security. Also we can make a bit of cryptography to
make some handshake to make it more robust." This note takes stock of what
still crosses the control plane, decides which of it moves to the browser ↔
host path and in what order, and records the first step, built with it: **the
host proves itself on every direct channel** before a byte crosses it.

## Why

The control plane is the one party everything touches: one Hetzner box behind
a Cloudflare tunnel (`deploy/dev/`). The direct path (22) already takes the
terminal's bytes off it once a channel is up, and DTLS encrypts that channel
end to end. But 22 also says "the DTLS fingerprints in them are what bind the
data channel to those two ends". Those fingerprints travel in SDP **the
control plane carries**. A control plane (or a tunnel in front of it) that is
compromised can answer the browser's offer itself, make its own offer to the
host, and sit between two DTLS sessions. Each end sees a valid channel and
every keystroke passes through the middle in the clear. Under the threat it
exists for, the direct path was only as private as the relay.

The fix is a handshake neither end can be talked out of. The host already has
the right key: the Ed25519 key it generated at pairing, whose private half
never left the machine (F8, 09 §3), and whose fingerprint
`oppenheimer-runner status` already prints and the "a new machine was paired"
email already quotes.

## What crosses the control plane, and where it should go

| Traffic | Today | Peer to peer? | When |
|---|---|---|---|
| Terminal bytes (PTY output, keystrokes) | relay until the channel is up, then direct (22) | yes, and now proved (below) | **built** |
| Resize and credit | attach socket | could ride the channel's text messages; they are metadata, not content | later, low value |
| A share's viewers (21) | always the relay | yes, for named people, up to the host's cap (22 step 3) | next |
| Agent transcript for the chat view (`attachment.chat`) | relay | yes, a second message kind on the channel | after |
| Pasted images and files | parked on the control plane, pulled by the runner over HTTPS (01) | yes, over the channel when one is open; the control plane path stays for a pane on the relay | after |
| Session previews' ports (30) | relay through the link | yes, a data channel per port | after |
| Device screen (simulator frames) | relay | yes, a channel or a media track | after |
| Signalling (offer, answer) | control plane | needs a rendezvous; made harmless by the proof rather than moved | — |
| Commands (create, stop, close, input to an unwatched window) | link | not moved: the control plane is the record. They can be **signed by the person's device** instead (below, step 5) | open |
| Events, hello, heartbeat | link | no: persisting them and drawing the sidebar is what the control plane is for | stays |
| Installation tokens | link, sealed to the host key (F7) | already end to end | stays |

There is still **no TURN server** (22): one on the control plane's box would
put the bytes back through the party this note is about, and one elsewhere is
a new party.

## Decided

### The host proves itself on every channel (built)

- **The first exchange on a direct channel is the proof, and nothing else
  crosses it first.** Three JSON text messages, binary staying PTY bytes only:

  ```text
  browser ── hello {v, nonce} ───────────▶ host
  browser ◀─ proof {v, key, sig} ───────── host
  browser ── ready {v} ──────────────────▶ host   then bytes, both ways
  ```

  The nonce is 32 random bytes, base64url. The host signs this transcript
  with its pairing key:

  ```text
  oppenheimer/direct/v1/host-proof
  offer-fingerprints:<the offer's a=fingerprint lines>
  answer-fingerprints:<the answer's a=fingerprint lines>
  nonce:<the nonce as sent>
  ```

  Each fingerprint list is every `a=fingerprint:` line, normalised as
  `<algorithm lowercase> <HEX UPPERCASE>`, de-duplicated, sorted by code unit
  and joined with commas. The runner (`internal/direct/handshake.go`) and the
  console (`stream/direct-handshake.ts`) each pin the same strings in a spec,
  so a drift on either side fails a build rather than every channel.
- **The browser checks the proof against its own peer connection**, not
  against anything the control plane said: the offer it sent, the answer it
  applied (which its DTLS checks the host's certificate against), and its own
  nonce. A man in the middle relays the host's proof faithfully, and the
  browser refuses it, because the host signed the middle's fingerprints. That
  case is a test on both sides: two pion peers splicing a real browser peer to
  the real answerer (`TestAManInTheMiddleIsRefusedByTheBrowser`), and the
  console's channel given a proof over another offer.
- **Only then does the channel carry the terminal.** The runner moves an
  attachment's output to the channel on `ready`, not when the data channel
  opens. A binary message before `ready`, a message out of turn, or no
  `ready` within five seconds closes the channel, and the attachment stays on
  the link (22's fallback, with nothing to repaint). The browser sends no
  keystroke on the channel and draws no byte from it until it has accepted the
  proof. Its fifteen-second answer timeout already covers a proof that never
  comes.
- **The key signs nothing else through this path.** The runner's pairing
  service exposes `ProveDirect`, which signs only a transcript that begins
  `oppenheimer/direct/v1/`; the same key signs boot tokens, whose JWS input
  begins with base64, so a proof can never be one. The key stays in the
  pairing package, as it does for `Unseal`.
- **A browser that cannot check Ed25519 does not take the channel.** WebCrypto
  has Ed25519 in every current browser. Where it is missing, the proof cannot
  be verified and the pane stays on the relay, which is where it would have
  been without 22.

### Trust on first use, pinned in the browser (built)

- **The first proof from a host pins its key, by host id.** The pin is the
  SHA-256 of the raw key in lowercase hex, the form `oppenheimer-runner status`
  prints on its `key` line and the pairing email quotes, so a person can
  compare the two (the console does not show it yet: step 1). Pins live in this browser's
  storage (`oppenheimer.direct.hostKeys`), or, where storage is refused, for
  the life of the page: a weaker pin, never a missing check.
- **Another key for a pinned host is refused, and that stream does not ask
  again.** What answered may not be the host, so a refused proof counts as
  every failure the stream allows (22 stops after two), not one. A valid
  signature under a new key is not the host changing its mind. Re-pairing
  redeems a new token, and registration makes a new host with a new id
  (`register-host`), so a re-paired machine is met afresh and is never a
  changed key.
- **The relay names the host** in `attached.direct.hostId`. With no host
  named the browser takes no direct path: it could not tell a new host from a
  changed key. The id comes from the control plane like everything else in
  the signalling. A control plane that lies about it can at most make a host
  look new, which is the limit of trust on first use, not a way around a pin.

### The relay invites only a runner that proves itself (built)

- **A new capability, `attachment.direct.proof`**, named beside
  `attachment.direct` by a runner that runs the handshake. The relay invites a
  direct path only to a runner naming both. A runner from before the proof
  stays on the relay: the console would refuse its channel anyway, and
  inviting it would only cost the reader a negotiation that ends where it
  started. No message on the link changed. The proof is inside the channel,
  so the relay neither sees it nor relays it.

### What the proof protects, and what it does not

- **It protects** the terminal's bytes on the direct path against a control
  plane, a tunnel or a network that rewrites the signalling, actively or not.
  The ICE servers (Cloudflare's STUN) are irrelevant to it: they learn
  addresses, never keys.
- **It does not protect the relay path.** A pane is on the relay for its first
  second, after a fallback, on a network that cannot connect directly, and
  for every share viewer. The control plane reads those bytes as it always
  has. Step 3 below is the fix.
- **It does not protect the first contact** with a host if the control plane
  is already compromised then. That is the limit of trust on first use, and
  the reason the fingerprint is printed on both ends.
- **It does not stop a compromised control plane from driving a host.** The
  link carries `session.create` with a prompt, which is code execution on the
  host by design. Making the control plane unable to forge that is step 5,
  and it is the larger part of "a compromised server cannot hurt me".

## Next, in order

1. **Show the pin.** On a pane whose host was refused, a "this host's key
   changed" state rather than a silent relay; the key's fingerprint beside the
   host in its settings; a way to forget a pin after a deliberate re-key. A
   change to what the console shows, so it goes with screenshots.
2. **Share links direct for named people** (22 step 3), now that the host
   proves itself to whoever opens the channel. `anyone` audiences stay on the
   relay.
3. **End to end on the relay path too.** The same proof, carried over the
   attach socket and the link, followed by an authenticated key exchange
   (X25519, keys bound into the signed transcript) and an AEAD stream
   (ChaCha20-Poly1305) for PTY bytes. The relay then carries ciphertext, and a
   fallback no longer hands the terminal back to the control plane. Nothing on
   the control plane reads PTY bytes (22), so nothing is lost. The cost is a
   frame header for the nonce and the end of the relay's fan-out (22 step 4)
   as a plain byte copy.
4. **More over the channel**: the chat transcript, pasted files, previews'
   ports and the device screen, each a message kind or a channel of its own
   behind its own capability.
5. **Device keys.** The browser makes a non-extractable Ed25519 key in
   WebCrypto and keeps it in IndexedDB. A host learns which devices may reach it
   by approving them on the host (`oppenheimer-runner devices approve`, the
   host being the one place the control plane cannot speak for the person).
   The runner then refuses a channel, and later a command, that an approved
   device did not sign. That makes the control plane a courier that cannot
   act on its own, which is the end state this note is aiming at.

## Open questions

1. **Pins per browser or per person.** A second browser meets every host
   afresh. Syncing pins through the control plane would let the control plane
   choose them. Pins signed by a device key (step 5) could travel safely.
2. **Key rotation** (F8, 09 §3). A rotated host key must be announced signed
   by the old one, so a pin can follow it instead of reading as a changed key.
3. **Whether resize and credit move onto the channel.** They are small and not
   secret, and they are what keeps the attach socket the source of truth (22).
   Probably not before step 3 decides what the socket carries.
