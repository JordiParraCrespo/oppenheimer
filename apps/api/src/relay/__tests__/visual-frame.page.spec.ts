/**
 * The page an agent's visual HTML runs in. What breaks this: the page served
 * on a session's preview origin (where an app's cookies live) or the console's,
 * a CSP that lets the fragment reach the network or be framed by anyone, or
 * the page answering a POST.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isVisualFrameHost, serveVisualFrame, VISUAL_FRAME_SHELL } from '../infrastructure/visual-frame.page';

const BASE = 'http://preview.localhost:3011';
const CONSOLE = 'http://localhost:3000';

let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer((req, res) => serveVisualFrame(req, res, CONSOLE));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('the visuals page', () => {
  it('is its own host under the preview domain, never a preview or another domain', () => {
    expect(isVisualFrameHost(BASE, 'visuals.preview.localhost:3011')).toBe(true);
    expect(isVisualFrameHost(BASE, 'VISUALS.preview.localhost:3011')).toBe(true);
    expect(isVisualFrameHost(BASE, `p5173-${'a'.repeat(32)}.preview.localhost:3011`)).toBe(false);
    expect(isVisualFrameHost(BASE, 'visuals.preview.localhost:9999')).toBe(false);
    expect(isVisualFrameHost(BASE, 'visuals.evil.example')).toBe(false);
    expect(isVisualFrameHost(BASE, undefined)).toBe(false);
  });

  it('closes the network and lets only the console frame it', async () => {
    const response = await fetch(url);
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(response.status).toBe(200);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain(`frame-ancestors ${CONSOLE}`);
    expect(csp).not.toMatch(/https?:\/\/(?!localhost:3000)/);
    expect(await response.text()).toBe(VISUAL_FRAME_SHELL);
  });

  it('answers nothing but GET and HEAD', async () => {
    const response = await fetch(url, { method: 'POST', body: 'x' });
    expect(response.status).toBe(405);
  });
});
