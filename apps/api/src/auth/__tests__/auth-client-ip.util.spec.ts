import type { AddressInfo } from 'node:net';
import { getIp } from 'better-auth/api';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_CLIENT_IP_HEADER,
  authIpAddressOptions,
  withAuthClientIp,
} from '../infrastructure/auth-client-ip.util';

/**
 * Better Auth's rate limit buckets `/api/auth/*` by the address `getIp` reads.
 * Before this, it read `X-Forwarded-For` as the client sent it, so a new header
 * per request was a new bucket and unlimited password guesses. These run the
 * real path: Express with `trust proxy` set as `main.ts` sets it, the
 * middleware `AppModule` wraps the Better Auth handler in, and Better Auth's
 * own `getIp` over the headers its handler would see.
 */
describe('the address Better Auth rate-limits on', () => {
  const servers: { close: () => void }[] = [];
  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
  });

  /** An app trusting `hops` proxies, answering the address Better Auth would key on. */
  async function appTrusting(hops: number): Promise<string> {
    const app = express();
    // Exactly what `main.ts` does with `TRUST_PROXY`.
    if (hops > 0) app.set('trust proxy', hops);
    app.use((req, res) =>
      withAuthClientIp()(req, res, () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(name, value);
        }
        res.json({ ip: getIp(headers, { advanced: { ipAddress: authIpAddressOptions } }) });
      }),
    );
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function keyFor(url: string, headers: Record<string, string>): Promise<string | null> {
    const response = await fetch(url, { headers });
    return ((await response.json()) as { ip: string | null }).ip;
  }

  it('with TRUST_PROXY=0, puts two requests with different X-Forwarded-For in the same bucket', async () => {
    const url = await appTrusting(0);

    const first = await keyFor(url, { 'x-forwarded-for': '203.0.113.1' });
    const second = await keyFor(url, { 'x-forwarded-for': '203.0.113.2' });

    expect(first).toBe('127.0.0.1');
    expect(second).toBe(first);
  });

  it('behind one proxy, keys on the address that proxy appended, not what the client prepended', async () => {
    const url = await appTrusting(1);

    const first = await keyFor(url, { 'x-forwarded-for': '198.51.100.7, 203.0.113.9' });
    const second = await keyFor(url, { 'x-forwarded-for': '198.51.100.8, 203.0.113.9' });

    expect(first).toBe('203.0.113.9');
    expect(second).toBe(first);
  });

  it('overwrites the header if the client sends it itself', async () => {
    const url = await appTrusting(0);

    const key = await keyFor(url, { [AUTH_CLIENT_IP_HEADER]: '203.0.113.50' });

    expect(key).toBe('127.0.0.1');
  });
});
