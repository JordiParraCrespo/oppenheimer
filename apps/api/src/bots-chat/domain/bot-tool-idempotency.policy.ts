import { createHash } from 'node:crypto';

/**
 * The key that makes an asking tool's effect happen once (`25-bots.md` §5):
 * the same call in the same turn starts one session or creates one bot,
 * however often the model repeats it; an approved call does it once per
 * approval, however often its job is retried. `call` is what the effect is
 * made from, digested whole.
 */
export function idempotencyKeyOf(turnId: string, call: unknown, approvalId?: string): string {
  if (approvalId) return `bot:approval:${approvalId}`;
  const digest = createHash('sha256').update(JSON.stringify(call)).digest('hex').slice(0, 32);
  return `bot:${turnId}:${digest}`;
}
