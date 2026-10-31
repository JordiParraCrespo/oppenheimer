/**
 * The browser's half of the host proof
 * (`product/versions/mvp/31-peer-to-peer-and-the-host-proof.md`), the first
 * exchange on every direct channel and the reason a control plane that
 * carries the signalling still cannot sit in the middle of it.
 *
 * DTLS encrypts the channel end to end, but the fingerprints that say whose
 * ends they are travel in SDP the control plane relays. So before a byte
 * crosses the channel the host signs both fingerprints, as it saw them, and a
 * nonce this browser chose, with the Ed25519 key it made at pairing. The
 * browser rebuilds the transcript from the SDP its own peer connection used,
 * checks the signature, and checks the key against the one it pinned for that
 * host the first time it met it: trust on first use, as SSH does, with the
 * fingerprint `oppenheimer-runner status` prints for a person who wants to
 * compare.
 *
 * The transcript and the fingerprint list must match the runner's byte for
 * byte (`apps/runner/internal/direct/handshake.go`); the specs on both sides
 * pin the same strings.
 */

export const PROOF_VERSION = 1;

const PROOF_CONTEXT = 'oppenheimer/direct/v1/host-proof';
const NONCE_BYTES = 32;
const ED25519_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

/**
 * Every DTLS fingerprint an SDP names, normalised as the runner does: the
 * algorithm lowercase, the hex uppercase, de-duplicated, sorted, joined with
 * commas. Empty when there is none.
 */
export function sdpFingerprints(sdp: string): string {
  const seen = new Set<string>();
  for (const raw of sdp.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('a=fingerprint:')) continue;
    const fields = line.slice('a=fingerprint:'.length).trim().split(/\s+/);
    if (fields.length !== 2) continue;
    seen.add(`${fields[0]?.toLowerCase()} ${fields[1]?.toUpperCase()}`);
  }
  // Code-unit order, as Go's sort.Strings: no locale may reorder it.
  return [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(',');
}

/** The bytes the host signs. */
export function proofTranscript(offer: string, answer: string, nonce: string): Uint8Array {
  return new TextEncoder().encode(
    `${PROOF_CONTEXT}\noffer-fingerprints:${offer}\nanswer-fingerprints:${answer}\nnonce:${nonce}\n`,
  );
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A fresh nonce for one handshake, base64url as it travels. */
export function newNonce(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
}

/** SHA-256 of the raw key, lowercase hex: the form `runner status` prints. */
export async function hostKeyFingerprint(key: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', key as Uint8Array<ArrayBuffer>),
  );
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether `signature` is the host's over `transcript`. False for anything
 * malformed, and false where this browser has no Ed25519: a proof it cannot
 * check is a proof it does not accept, and the pane stays on the relay.
 */
export async function verifyHostProof(
  key: Uint8Array,
  signature: Uint8Array,
  transcript: Uint8Array,
): Promise<boolean> {
  if (key.byteLength !== ED25519_KEY_BYTES || signature.byteLength !== ED25519_SIGNATURE_BYTES) {
    return false;
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      key as Uint8Array<ArrayBuffer>,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      signature as Uint8Array<ArrayBuffer>,
      transcript as Uint8Array<ArrayBuffer>,
    );
  } catch {
    return false;
  }
}

/**
 * The host keys this browser has met, by host id: the first proof from a host
 * pins its key, and a later proof with another key is refused.
 */
export interface HostKeyPins {
  /** The pinned fingerprint, or `null` for a host never met. */
  get(hostId: string): string | null;
  set(hostId: string, fingerprint: string): void;
}

const PINS_KEY = 'oppenheimer.direct.hostKeys';

/**
 * Pins kept in this browser's storage, so they outlive the tab. Where storage
 * is unavailable (a private window that refuses it) they last as long as the
 * page: a weaker pin, never a missing check.
 */
export function browserHostKeyPins(): HostKeyPins {
  const memory = new Map<string, string>();
  const read = (): Record<string, string> => {
    try {
      const raw = globalThis.localStorage?.getItem(PINS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  };
  return {
    get(hostId) {
      const stored = read()[hostId];
      return typeof stored === 'string' ? stored : (memory.get(hostId) ?? null);
    },
    set(hostId, fingerprint) {
      memory.set(hostId, fingerprint);
      try {
        globalThis.localStorage?.setItem(
          PINS_KEY,
          JSON.stringify({ ...read(), [hostId]: fingerprint }),
        );
      } catch {
        // Kept in memory above; storage refused it.
      }
    },
  };
}

export type ProofVerdict = 'trusted' | 'invalid' | 'key-changed';

/**
 * Judges the host's `proof` message for the handshake that sent `nonce`:
 * the signature over this peer connection's own fingerprints, then the key
 * against the pin. A first proof from a host pins its key.
 */
export async function judgeHostProof(input: {
  message: unknown;
  hostId: string;
  offerSdp: string;
  answerSdp: string;
  nonce: string;
  pins: HostKeyPins;
}): Promise<ProofVerdict> {
  const m = input.message as { t?: unknown; v?: unknown; key?: unknown; sig?: unknown } | null;
  if (m?.t !== 'proof' || m.v !== PROOF_VERSION) return 'invalid';
  if (typeof m.key !== 'string' || typeof m.sig !== 'string') return 'invalid';
  const key = fromBase64Url(m.key);
  const signature = fromBase64Url(m.sig);
  const offer = sdpFingerprints(input.offerSdp);
  const answer = sdpFingerprints(input.answerSdp);
  if (!key || !signature || !offer || !answer) return 'invalid';
  const transcript = proofTranscript(offer, answer, input.nonce);
  if (!(await verifyHostProof(key, signature, transcript))) return 'invalid';
  const fingerprint = await hostKeyFingerprint(key);
  const pinned = input.pins.get(input.hostId);
  if (pinned === null) {
    input.pins.set(input.hostId, fingerprint);
    return 'trusted';
  }
  return pinned === fingerprint ? 'trusted' : 'key-changed';
}
