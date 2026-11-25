/**
 * What a routine's run keeps of the webhook body that started it. The excerpt
 * is stored on the run (`automation_runs.trigger_payload`, jsonb) and shown on
 * the run's page, so it is capped: a body can be megabytes.
 *
 * The cap counts code points, so a cut never splits a surrogate pair (jsonb
 * refuses a lone surrogate), and NUL is dropped first, which Postgres text
 * refuses too.
 */
export const PAYLOAD_EXCERPT_MAX = 16_384;

export interface PayloadExcerpt {
  text: string;
  truncated: boolean;
}

export function payloadExcerptOf(body: string): PayloadExcerpt {
  const points = Array.from(body.replaceAll('\u0000', ''));
  if (points.length <= PAYLOAD_EXCERPT_MAX) return { text: points.join(''), truncated: false };
  return { text: points.slice(0, PAYLOAD_EXCERPT_MAX).join(''), truncated: true };
}
