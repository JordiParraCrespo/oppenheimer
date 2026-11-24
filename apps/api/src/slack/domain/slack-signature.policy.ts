import { createHmac, timingSafeEqual } from 'node:crypto';

/** How old a signed request may be: Slack's own advice, so a captured one cannot be replayed later. */
export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

/**
 * Whether a request is Slack's, for the app with this signing secret: the
 * `X-Slack-Signature` header is `v0=` and the HMAC-SHA256, under the secret, of
 * `v0:<X-Slack-Request-Timestamp>:<the raw body>`, and the timestamp is within
 * five minutes of `now`. Compared in constant time.
 */
export function isSlackSigned(
  signingSecret: string,
  request: { timestamp: string; signature: string; body: Buffer },
  now: Date,
): boolean {
  if (!/^\d{1,12}$/.test(request.timestamp)) return false;
  const age = Math.abs(now.getTime() / 1000 - Number(request.timestamp));
  if (age > SLACK_SIGNATURE_MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(
    `v0=${createHmac('sha256', signingSecret)
      .update(`v0:${request.timestamp}:`)
      .update(request.body)
      .digest('hex')}`,
  );
  const given = Buffer.from(request.signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
