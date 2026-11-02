import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`).
 *
 * `sealKey` is optional capability config: it is the AES-256-GCM key a
 * person's vendor key (Cursor's) is sealed under, 32 bytes as base64. With it
 * the `cloud_agents` capability is on; without it the credential and launch
 * routes answer `CLOUD_AGENTS_003`, and nothing else in the API is affected.
 */
const schema = z.object({
  sealKey: z.string().optional(),
  /**
   * Cursor's API, defaulted rather than optional: a deployment talks to
   * Cursor, and this is the seam an end-to-end run points at a stub.
   */
  cursorApiUrl: z.string().url().default('https://api.cursor.com'),
});

export const cloudAgentsConfig = registerAs('cloudAgents', () =>
  parseEnv('cloudAgents', schema, {
    sealKey: 'CLOUD_AGENTS_KEY',
    cursorApiUrl: 'CLOUD_AGENTS_CURSOR_API_URL',
  }),
);

/** A key `CLOUD_AGENTS_KEY` can hold: 32 bytes, base64; null otherwise. */
export function cloudAgentsSealKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
