import { describe, expect, it } from 'vitest';
import { previewPort } from '../lib/preview-port';

/**
 * Which of a session's ports the Browser tab opens on: the reader's pick
 * while it lasts, else the likeliest front end, so a session that runs its
 * API beside its dev server opens on the page and not the API's JSON.
 */
const ports = (...numbers: number[]) => numbers.map((port) => ({ port, process: 'node' }));

describe('previewPort', () => {
  it('opens on the dev server, not the API beside it on a lower port', () => {
    expect(previewPort(ports(3002, 5173), null)).toBe(5173);
    expect(previewPort(ports(3001, 3000), null)).toBe(3000);
  });

  it('keeps the reader’s pick while the session still listens on it', () => {
    expect(previewPort(ports(3002, 5173), 3002)).toBe(3002);
    expect(previewPort(ports(5173), 3002)).toBe(5173);
  });

  it('opens on the lowest port when none is a known dev server’s, and on none without ports', () => {
    expect(previewPort(ports(9100, 7000), null)).toBe(9100);
    expect(previewPort([], null)).toBeUndefined();
  });
});
