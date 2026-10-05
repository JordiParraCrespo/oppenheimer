import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  parseInstallationEvent,
  verifyWebhookSignature,
} from '../infrastructure/github-webhook.util';

const SECRET = 'a-webhook-signing-secret';

function sign(payload: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

/**
 * The webhook signature is the whole credential on `POST /github/webhook`:
 * the route carries `@NoPolicy`, so if this check is wrong the endpoint is a
 * public way to mark any installation suspended or uninstalled.
 */
describe('webhook signature', () => {
  const body = JSON.stringify({ action: 'suspend', installation: { id: 42 } });

  it('accepts a signature over the exact bytes received', () => {
    expect(verifyWebhookSignature(SECRET, body, sign(body))).toBe(true);
  });

  it('accepts the same bytes as a Buffer', () => {
    // The controller passes `request.rawBody`, which is a Buffer; a digest over
    // a re-serialized object would not match what GitHub signed.
    const raw = Buffer.from(body, 'utf8');
    expect(verifyWebhookSignature(SECRET, raw, sign(body))).toBe(true);
  });

  it('refuses a signature made with another secret', () => {
    expect(verifyWebhookSignature(SECRET, body, sign(body, 'not-our-secret'))).toBe(false);
  });

  it('refuses a body that changed after it was signed', () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ action: 'deleted', installation: { id: 42 } });
    expect(verifyWebhookSignature(SECRET, tampered, signature)).toBe(false);
  });

  it('refuses a re-serialized body, byte for byte', () => {
    const reserialized = JSON.stringify({ installation: { id: 42 }, action: 'suspend' });
    expect(verifyWebhookSignature(SECRET, reserialized, sign(body))).toBe(false);
  });

  it('refuses a missing or malformed signature without throwing', () => {
    expect(verifyWebhookSignature(SECRET, body, undefined)).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, '')).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, 'sha256=short')).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, sign(body).toUpperCase())).toBe(false);
  });

  it('refuses everything when no secret is configured', () => {
    // Otherwise an unconfigured deployment would accept an unsigned delivery.
    expect(verifyWebhookSignature('', body, sign(body, ''))).toBe(false);
  });
});

describe('installation event parsing', () => {
  const payload = (action: string, id: unknown = 42) =>
    JSON.stringify({ action, installation: { id } });

  it('narrows the three actions this module acts on', () => {
    expect(parseInstallationEvent('installation', payload('suspend'))).toEqual({
      type: 'installation',
      action: 'suspend',
      githubInstallationId: 42,
      occurredAt: null,
    });
    expect(parseInstallationEvent('installation', payload('unsuspend'))).toMatchObject({
      action: 'unsuspend',
    });
    expect(parseInstallationEvent('installation', payload('deleted'))).toMatchObject({
      action: 'delete',
    });
  });

  it('ignores every other event', () => {
    expect(parseInstallationEvent('installation_repositories', payload('added'))).toEqual({
      type: 'ignored',
    });
    expect(parseInstallationEvent('push', payload('suspend'))).toEqual({ type: 'ignored' });
    expect(parseInstallationEvent(undefined, payload('suspend'))).toEqual({ type: 'ignored' });
  });

  it('ignores an action this module has no answer for', () => {
    expect(parseInstallationEvent('installation', payload('new_permissions_accepted'))).toEqual({
      type: 'ignored',
    });
  });

  it('ignores a delivery with no usable installation id', () => {
    expect(parseInstallationEvent('installation', payload('suspend', null))).toEqual({
      type: 'ignored',
    });
    expect(parseInstallationEvent('installation', '{"action":"suspend"}')).toEqual({
      type: 'ignored',
    });
    expect(parseInstallationEvent('installation', 'not json at all')).toEqual({ type: 'ignored' });
  });

  it("reads GitHub's own time of the change, not ours", () => {
    const at = (action: string, installation: Record<string, unknown>) =>
      parseInstallationEvent('installation', JSON.stringify({ action, installation }));

    expect(at('unsuspend', { id: 42, updated_at: '2026-09-01T10:00:00Z' })).toMatchObject({
      occurredAt: new Date('2026-09-01T10:00:00Z'),
    });
    expect(
      at('suspend', {
        id: 42,
        suspended_at: '2026-09-01T09:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      }),
    ).toMatchObject({ occurredAt: new Date('2026-09-01T09:00:00Z') });
    expect(at('suspend', { id: 42, updated_at: '2026-09-01T10:00:00Z' })).toMatchObject({
      occurredAt: new Date('2026-09-01T10:00:00Z'),
    });
    expect(at('deleted', { id: 42, updated_at: 1_788_000_000 })).toMatchObject({
      occurredAt: new Date(1_788_000_000_000),
    });
  });

  it('has no time for a payload whose timestamp is missing or unreadable', () => {
    const at = (updated: unknown) =>
      parseInstallationEvent(
        'installation',
        JSON.stringify({ action: 'unsuspend', installation: { id: 42, updated_at: updated } }),
      );
    expect(at(undefined)).toMatchObject({ occurredAt: null });
    expect(at('yesterday-ish')).toMatchObject({ occurredAt: null });
    expect(at({ nested: true })).toMatchObject({ occurredAt: null });
  });
});
