import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The `installation` webhook, verified and narrowed.
 *
 * It is the only event this module subscribes to, because it is the only one
 * that reports a fact about an installation that changes without us and that a
 * token mint must respect. Nothing mirrors the repository set, so there is
 * nothing for `installation_repositories` to keep current.
 *
 * A delivery is a status write and is idempotent to repeat, which is why there
 * is no delivery table and no de-duplication key.
 */
export type InstallationWebhookAction = 'suspend' | 'unsuspend' | 'delete';

export type InstallationWebhookEvent =
  | { type: 'installation'; action: InstallationWebhookAction; githubInstallationId: number }
  | { type: 'ignored' };

const ACTIONS: Record<string, InstallationWebhookAction> = {
  suspend: 'suspend',
  unsuspend: 'unsuspend',
  deleted: 'delete',
};

/**
 * Verify `X-Hub-Signature-256` against an HMAC-SHA256 of the **exact bytes**
 * received.
 *
 * Two details are load-bearing. The digest is taken over the raw body rather
 * than a re-serialized object, because any re-encoding — key order, unicode
 * escaping, whitespace — changes the bytes and so the signature. And the
 * comparison is constant-time, so a mismatch leaks no information about how far
 * a forged signature got.
 */
export function verifyWebhookSignature(
  secret: string,
  payload: Buffer | string,
  signature: string | undefined,
): boolean {
  if (!secret || !signature) return false;

  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`,
  );
  const presented = Buffer.from(signature);
  // `timingSafeEqual` throws on a length mismatch, so the lengths are compared
  // first — a length difference is not a secret.
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

/**
 * Narrow a verified delivery into the three facts this module acts on. Anything
 * else — another event, another action, a payload without an installation id —
 * is `ignored`, which the route answers 200 to: GitHub retries a non-2xx, and
 * there is nothing to retry.
 */
export function parseInstallationEvent(
  event: string | undefined,
  payload: Buffer | string,
): InstallationWebhookEvent {
  if (event !== 'installation') return { type: 'ignored' };

  const body = safeParse(payload);
  if (!body) return { type: 'ignored' };

  const action = ACTIONS[String(body.action)];
  if (!action) return { type: 'ignored' };

  const installation = body.installation;
  const id =
    installation && typeof installation === 'object'
      ? Number((installation as Record<string, unknown>).id)
      : Number.NaN;
  if (!Number.isInteger(id) || id <= 0) return { type: 'ignored' };

  return { type: 'installation', action, githubInstallationId: id };
}

function safeParse(payload: Buffer | string): Record<string, unknown> | null {
  try {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
