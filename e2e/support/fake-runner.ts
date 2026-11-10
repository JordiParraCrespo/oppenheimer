import { createHash, generateKeyPairSync, type KeyObject, randomUUID, sign } from 'node:crypto';
import { type APIRequestContext, expect } from '@playwright/test';
import { API_URL } from '../playwright.config';
import { newContext } from './auth';
import { mintPairingToken, registerHost } from './sessions';

/**
 * A runner on the link, written in TypeScript so a spec can play the
 * service a capability fronts (Telegram, WhatsApp): it pairs through the real
 * mint-and-redeem flow, dials `/api/v1/relay/runner` with a signed boot
 * assertion, says hello with one capability, records every frame the control
 * plane sends, and leaves what to answer to the subclass
 * (`telegram-runner.ts`, `whatsapp-runner.ts`).
 *
 * A real runner cannot stand there: its clients are fixed to the real
 * services, and pointing them elsewhere would be a test-only seam.
 */

/** `apps/runner/internal/host/domain.Facts` as Go marshals it. */
function factsFor(hostname: string) {
  return {
    platform: 'debian',
    osVersion: '13',
    arch: 'amd64',
    hostname,
    user: 'runner',
    home: '/home/runner',
    root: false,
    tools: [
      { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
      { name: 'tmux', path: '/usr/bin/tmux', version: '3.5a', required: true },
    ],
    workspacePath: '/home/runner/oppenheimer-ai',
    diskFreeBytes: 53_687_091_200,
    runnerVersion: '0.9.0',
  };
}

/** A frame the control plane sent, as JSON. */
export type Frame = { type: string; [key: string]: unknown };

function hostKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return { privateKey, base64: raw.toString('base64') };
}

/** The short-lived boot assertion the runner signs on every dial (`hosts.spec.ts`). */
function bootAssertion(privateKey: KeyObject, hostId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: hostId,
      sub: hostId,
      aud: API_URL,
      jti: createHash('sha256').update(`${hostId}:${Math.random()}`).digest('hex').slice(0, 32),
      iat: now,
      exp: now + 300,
    }),
  ).toString('base64url');
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

/** A paired host, before its link is dialled. */
export interface PairedHost {
  hostId: string;
  privateKey: KeyObject;
  hostname: string;
}

export abstract class FakeRunner {
  /** Every frame the control plane sent, in order. */
  readonly frames: Frame[] = [];
  private socket: WebSocket | null = null;

  protected constructor(
    private readonly host: PairedHost,
    private readonly capability: string,
  ) {}

  get hostId(): string {
    return this.host.hostId;
  }

  /**
   * Pair a host for the caller's workspace. Pairing is throttled per address,
   * so a spec file pairs one and the test is slow.
   */
  protected static async pairHost(
    api: APIRequestContext,
    name: string,
    hostname: string,
  ): Promise<PairedHost> {
    const secret = await mintPairingToken(api, name);
    const key = hostKey();
    const anonymous = await newContext();
    const registered = await registerHost(anonymous, {
      token: secret,
      name,
      publicKey: key.base64,
      facts: factsFor(hostname),
    });
    expect(registered.status(), await registered.text()).toBe(201);
    const { hostId } = (await registered.json()) as { hostId: string };
    await anonymous.dispose();
    return { hostId, privateKey: key.privateKey, hostname };
  }

  /** Whether a frame of this type arrived since `from`. */
  received(type: string, from = 0): boolean {
    return this.frames.slice(from).some((frame) => frame.type === type);
  }

  close(): void {
    this.socket?.close(1000, 'test over');
    this.socket = null;
  }

  /** Says how the service stands, right after hello, as the real runner does. */
  protected abstract afterHello(): void;

  /** Answers one frame the control plane sent, as the service would. */
  protected abstract answer(frame: Frame): void;

  protected send(frame: Record<string, unknown>): void {
    if (!this.socket) throw new Error('the fake runner has no link');
    this.socket.send(JSON.stringify(frame));
  }

  /**
   * Send `frame` (a batch of inbound messages) and resolve with the keys of
   * the `ackType` frame that names any of `keys`: the control plane acks only
   * what it stored.
   */
  protected async sendAndAwaitAck(
    frame: Record<string, unknown>,
    ackType: string,
    keys: ReadonlySet<string>,
  ): Promise<string[]> {
    const from = this.frames.length;
    this.send(frame);
    let acked: string[] = [];
    await expect
      .poll(
        () => {
          const ack = this.frames
            .slice(from)
            .find(
              (sent) =>
                sent.type === ackType && (sent.keys as string[]).some((key) => keys.has(key)),
            );
          acked = (ack?.keys as string[] | undefined) ?? [];
          return acked.length > 0;
        },
        { message: `${ackType} for the batch`, timeout: 15_000 },
      )
      .toBe(true);
    return acked;
  }

  protected async dial(): Promise<void> {
    const facts = factsFor(this.host.hostname);
    const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/v1/relay/runner`, {
      // Undici's extension: the runner presents its boot assertion as a bearer.
      headers: {
        authorization: `Bearer ${bootAssertion(this.host.privateKey, this.host.hostId)}`,
      },
    } as unknown as string[]);
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const frame = JSON.parse(event.data) as Frame;
      this.frames.push(frame);
      this.answer(frame);
    });
    await new Promise<void>((ok, fail) => {
      socket.addEventListener('open', () => ok(), { once: true });
      socket.addEventListener('error', () => fail(new Error('runner link refused')), {
        once: true,
      });
    });
    this.send({
      type: 'hello',
      runnerVersion: facts.runnerVersion,
      protocol: { min: 1, max: 1 },
      runId: randomUUID(),
      host: facts,
      sessions: [],
      capabilities: [this.capability],
    });
    this.afterHello();
  }
}
