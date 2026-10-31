import { beforeEach, describe, expect, it } from 'vitest';
import {
  browserHostKeyPins,
  type HostKeyPins,
  hostKeyFingerprint,
  judgeHostProof,
  proofTranscript,
  sdpFingerprints,
  toBase64Url,
} from '../direct-handshake';

/**
 * The browser's half of the host proof (31) against real Ed25519 keys. The
 * transcript and the fingerprint list are pinned to the same strings the
 * runner's `handshake_test.go` pins: a drift on either side is every direct
 * path refused. The handshake on a channel is `direct-path.spec.ts`.
 */

const OFFER = 'v=0\r\na=fingerprint:sha-256 0a:0b\r\n';
const ANSWER = 'v=0\r\na=fingerprint:sha-256 1A:1B\r\n';
const NONCE = 'bm9uY2U';

async function host() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const sign = async (transcript: Uint8Array) =>
    new Uint8Array(
      await crypto.subtle.sign(
        { name: 'Ed25519' },
        pair.privateKey,
        transcript as Uint8Array<ArrayBuffer>,
      ),
    );
  return {
    raw,
    async proof(offer = OFFER, answer = ANSWER, nonce = NONCE) {
      const sig = await sign(
        proofTranscript(sdpFingerprints(offer), sdpFingerprints(answer), nonce),
      );
      return { t: 'proof', v: 1, key: toBase64Url(raw), sig: toBase64Url(sig) };
    },
  };
}

function memoryPins(): HostKeyPins {
  const pins = new Map<string, string>();
  return { get: (id) => pins.get(id) ?? null, set: (id, fp) => void pins.set(id, fp) };
}

const judge = (message: unknown, pins: HostKeyPins, answerSdp = ANSWER) =>
  judgeHostProof({ message, hostId: 'host-1', offerSdp: OFFER, answerSdp, nonce: NONCE, pins });

beforeEach(() => localStorage.clear());

describe('the host proof', () => {
  it('normalises fingerprints as the runner does: case, order and duplicates', () => {
    const sdp =
      'v=0\r\na=fingerprint:SHA-256 ab:cd\r\nm=application 9\r\na=fingerprint:sha-256 AB:CD\r\na=fingerprint:sha-1 01:02\r\n';
    expect(sdpFingerprints(sdp)).toBe('sha-1 01:02,sha-256 AB:CD');
    expect(sdpFingerprints('v=0\r\n')).toBe('');
  });

  it('rebuilds the transcript the runner signs, byte for byte', () => {
    expect(new TextDecoder().decode(proofTranscript('sha-256 AA', 'sha-256 BB', NONCE))).toBe(
      'oppenheimer/direct/v1/host-proof\noffer-fingerprints:sha-256 AA\nanswer-fingerprints:sha-256 BB\nnonce:bm9uY2U\n',
    );
  });

  it('trusts a valid first proof and pins the key by the fingerprint runner status prints', async () => {
    const h = await host();
    const pins = memoryPins();
    expect(await judge(await h.proof(), pins)).toBe('trusted');
    expect(pins.get('host-1')).toBe(await hostKeyFingerprint(h.raw));
    expect(pins.get('host-1')).toMatch(/^[0-9a-f]{64}$/);
    expect(await judge(await h.proof(), pins)).toBe('trusted');
  });

  it('refuses another key for a pinned host, and leaves the pin as it was', async () => {
    const pins = memoryPins();
    const real = await host();
    await judge(await real.proof(), pins);
    const pinned = pins.get('host-1');
    expect(await judge(await (await host()).proof(), pins)).toBe('key-changed');
    expect(pins.get('host-1')).toBe(pinned);
  });

  it('refuses a proof over other fingerprints, another nonce, or a broken signature, and pins nothing', async () => {
    const h = await host();
    const pins = memoryPins();
    const middle = 'v=0\r\na=fingerprint:sha-256 EE:EE\r\n';
    expect(await judge(await h.proof(OFFER, middle), pins)).toBe('invalid');
    expect(await judge(await h.proof(OFFER, ANSWER, 'b3RoZXI'), pins)).toBe('invalid');
    const proof = await h.proof();
    expect(await judge({ ...proof, sig: proof.key }, pins)).toBe('invalid');
    expect(await judge({ ...proof, v: 2 }, pins)).toBe('invalid');
    expect(await judge(await h.proof(), pins, 'v=0\r\n')).toBe('invalid');
    expect(pins.get('host-1')).toBeNull();
  });

  it('keeps pins in this browser across streams', () => {
    browserHostKeyPins().set('host-1', 'ab');
    expect(browserHostKeyPins().get('host-1')).toBe('ab');
  });
});
