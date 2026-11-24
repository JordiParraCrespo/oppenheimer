/**
 * What a routine's run keeps of the webhook body that started it. The excerpt
 * is stored on the run (`automation_runs.trigger_payload`, jsonb) and shown on
 * the run's page, so it is capped: a body can be megabytes.
 */
export const PAYLOAD_EXCERPT_MAX = 16_384;

export interface PayloadExcerpt {
  text: string;
  truncated: boolean;
}

export function payloadExcerptOf(body: string): PayloadExcerpt {
  if (body.length <= PAYLOAD_EXCERPT_MAX) return { text: body, truncated: false };
  return { text: body.slice(0, PAYLOAD_EXCERPT_MAX), truncated: true };
}
