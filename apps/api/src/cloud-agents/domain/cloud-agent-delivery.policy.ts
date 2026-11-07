import { CloudAgentErrors } from './cloud-agents.errors';

/**
 * Whether a vendor call that failed with `code` certainly did nothing at the
 * vendor: the server has no key store, the caller no key, the vendor refused
 * the key or the request as asked, said the agent is busy, or the limiter
 * refused before sending or on the vendor's own 429. Anything else
 * (`CLOUD_AGENTS_006`: a timeout, a dropped connection, a 5xx, an answer we
 * could not read) may have reached the vendor and been acted on, so a caller
 * that writes "not delivered" for it could hide a run that is going.
 */
const NEVER_ACTED_ON: ReadonlySet<string> = new Set([
  CloudAgentErrors.NOT_CONFIGURED.code,
  CloudAgentErrors.NOT_CONNECTED.code,
  CloudAgentErrors.KEY_REFUSED.code,
  CloudAgentErrors.RATE_LIMITED.code,
  CloudAgentErrors.REQUEST_REFUSED.code,
  CloudAgentErrors.PROVIDER_NOT_FOUND.code,
  CloudAgentErrors.AGENT_BUSY.code,
]);

export function cloudCallNeverActedOn(code: string): boolean {
  return NEVER_ACTED_ON.has(code);
}
