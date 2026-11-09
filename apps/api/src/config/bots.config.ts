import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Bots (`product/versions/mvp/25-bots.md` §2).
 *
 * `providerKey` is optional capability config: it is the AES-256-GCM key a
 * workspace's model provider keys are sealed under, 32 bytes as base64. With
 * it the `bot_providers` capability is on; without it the provider routes
 * answer `BOTS_011` and a bot cannot answer, while everything else about bots
 * works.
 *
 * `docsUrl` is optional too: where this deployment publishes its docs site
 * (`apps/docs`). With it, a bot reading Oppenheimer's guide links the person
 * to the page it read; without it the bot still reads the same pages, which
 * ship with the API (`@oppenheimer/shared/guide`), and links nothing.
 */
const schema = z.object({
  providerKey: z.string().optional(),
  docsUrl: z.string().url().optional(),
});

export const botsConfig = registerAs('bots', () =>
  parseEnv('bots', schema, { providerKey: 'BOTS_PROVIDER_KEY', docsUrl: 'DOCS_URL' }),
);

/** A key `BOTS_PROVIDER_KEY` can hold: 32 bytes, base64; null otherwise. */
export function botsProviderKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
