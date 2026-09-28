import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { InstallationStatusChange } from '../database/github-installation.repository.port';

/**
 * The `installation` webhook, verified and narrowed.
 *
 * It is the only event this module subscribes to, because it is the only one
 * that reports a fact about an installation that changes without us and that a
 * token mint must respect. Nothing mirrors the repository set, so there is
 * nothing for `installation_repositories` to keep current.
 *
 * A delivery is a status write, idempotent to repeat **and ordered by GitHub's
 * own timestamp** (`occurredAt`). GitHub does not promise delivery order, and a
 * retry can land after a newer delivery, so a suspend or unsuspend applies only
 * when it is newer than the last one the row took: a late retry, or a replay
 * of an older captured body, is a no-op. That is why this path still has no
 * delivery table and no de-duplication key.
 */
export type InstallationWebhookAction = 'suspend' | 'unsuspend' | 'delete';

export type InstallationWebhookEvent =
  | {
      type: 'installation';
      action: InstallationWebhookAction;
      githubInstallationId: number;
      /**
       * When GitHub says the change happened: `installation.suspended_at` for a
       * suspend, `installation.updated_at` otherwise. `null` when the payload
       * carries no usable time.
       */
      occurredAt: Date | null;
    }
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

  const fields = installation as Record<string, unknown>;
  const occurredAt =
    (action === 'suspend' ? timestampOf(fields.suspended_at) : null) ??
    timestampOf(fields.updated_at);
  return { type: 'installation', action, githubInstallationId: id, occurredAt };
}

/**
 * The status write an installation delivery asks for: only the columns its
 * action is about, so everything else is left alone. A suspension holds
 * GitHub's time; an uninstall, like a disconnect here, holds the time we
 * learned of it. A payload with no time is ordered by `receivedAt`.
 */
export function installationStatusChange(
  delivery: Extract<InstallationWebhookEvent, { type: 'installation' }>,
  receivedAt: Date,
): InstallationStatusChange {
  const occurredAt = delivery.occurredAt ?? receivedAt;
  const base = { githubInstallationId: delivery.githubInstallationId, occurredAt };
  if (delivery.action === 'suspend') return { ...base, suspendedAt: occurredAt };
  if (delivery.action === 'unsuspend') return { ...base, suspendedAt: null };
  return { ...base, deletedAt: receivedAt };
}

/**
 * The SHA-256 of the **raw bytes** GitHub signed, hex. Not of the parsed object:
 * the hub stores the payload as `jsonb`, which normalizes whitespace and key
 * order, and a replay is the same bytes under a new unsigned delivery id.
 */
export function payloadDigest(payload: Buffer | string): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** A delivery body the hub can store: a JSON object, or `null`. */
export function parseDeliveryBody(payload: Buffer | string): Record<string, unknown> | null {
  const body = safeParse(payload);
  return body && !Array.isArray(body) ? body : null;
}

/** An ISO 8601 string, or epoch seconds as some GitHub payloads carry; else `null`. */
function timestampOf(value: unknown): Date | null {
  const date =
    typeof value === 'string'
      ? new Date(value)
      : typeof value === 'number'
        ? new Date(value * 1000)
        : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
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
