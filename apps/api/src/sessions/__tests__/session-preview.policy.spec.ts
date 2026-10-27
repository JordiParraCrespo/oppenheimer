/**
 * The preview origin of a session's port: one per session and port, read back
 * from a request's Host, and never a host or a path that leads off the
 * deployment's preview domain. The proxy that serves them is the relay's
 * (`relay/__tests__/preview-proxy.spec.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  previewAddressOf,
  previewEnterUrl,
  previewOrigin,
  safePreviewPath,
} from '../domain/session-preview.policy';

const base = 'http://preview.localhost:3001';
const sessionId = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

describe('session preview addresses', () => {
  it('gives each session and port an origin of its own, and reads it back', () => {
    const origin = previewOrigin(base, { sessionId, port: 5173 });
    expect(origin).toBe('http://p5173-3f0d9e2c6a4b4e9a9c3d7b1e5a2f8c40.preview.localhost:3001');
    expect(previewAddressOf(base, new URL(origin).host)).toEqual({ sessionId, port: 5173 });
  });

  it('reads no preview from the console, another domain or a forged label', () => {
    expect(previewAddressOf(base, 'localhost:3001')).toBeNull();
    expect(previewAddressOf(base, 'preview.localhost:3001')).toBeNull();
    // The preview domain's name inside another domain is not it.
    expect(
      previewAddressOf(
        base,
        'p5173-3f0d9e2c6a4b4e9a9c3d7b1e5a2f8c40.preview.localhost.evil.test:3001',
      ),
    ).toBeNull();
    // Served on another port than the preview domain's.
    expect(
      previewAddressOf(base, 'p5173-3f0d9e2c6a4b4e9a9c3d7b1e5a2f8c40.preview.localhost:3000'),
    ).toBeNull();
    // A system port is never a preview.
    expect(
      previewAddressOf(base, 'p0022-3f0d9e2c6a4b4e9a9c3d7b1e5a2f8c40.preview.localhost:3001'),
    ).toBeNull();
    expect(previewAddressOf(base, 'p5173-xyz.preview.localhost:3001')).toBeNull();
  });

  it('opens on a path inside the app, never one that leaves it', () => {
    const url = new URL(
      previewEnterUrl(base, { sessionId, port: 5173 }, 'tkt', { path: '/docs?x=1', embed: true }),
    );
    expect(url.pathname).toBe('/__oppenheimer/enter');
    expect(url.searchParams.get('path')).toBe('/docs?x=1');
    expect(url.searchParams.get('embed')).toBe('1');
    for (const away of ['//evil.test', 'https://evil.test', '/\\evil.test', 'docs']) {
      expect(safePreviewPath(away)).toBe('/');
    }
  });
});
