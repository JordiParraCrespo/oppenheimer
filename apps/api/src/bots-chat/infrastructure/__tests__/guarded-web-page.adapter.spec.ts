import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GuardedWebPageAdapter } from '../guarded-web-page.adapter';

/**
 * The fetch refuses before it connects: a URL that names a private place,
 * by literal or by a name that resolves to one, never reaches a socket. A
 * server listening on loopback stands in for the control plane's own
 * services, and must see no request. Which addresses count as private is
 * the policy spec's.
 */
describe('GuardedWebPageAdapter', () => {
  let server: Server;
  let port: number;
  let hits = 0;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      hits++;
      response.end('secret');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const fetchPage = (url: string) =>
    new GuardedWebPageAdapter().fetch(url, new AbortController().signal);

  it.each([
    () => `http://127.0.0.1:${port}/`,
    () => `http://localhost:${port}/`,
    () => `http://[::ffff:127.0.0.1]:${port}/`,
    () => `http://0x7f.0.0.1:${port}/`,
  ])('refuses the server’s own loopback (%#), and no request reaches it', async (url) => {
    const result = await fetchPage(url());
    expect(result).toMatchObject({ kind: 'refused' });
    expect(hits).toBe(0);
  });

  it('refuses what is not http or https, and what is not a URL', async () => {
    expect(await fetchPage('file:///etc/hostname')).toMatchObject({ kind: 'refused' });
    expect(await fetchPage('not a url')).toEqual({
      kind: 'refused',
      reason: 'That is not a valid URL.',
    });
  });
});
