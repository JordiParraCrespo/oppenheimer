import type { ConfigService } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv, positiveInt } from './env';

/**
 * The relay's side of the direct terminal path
 * (`product/versions/mvp/22-direct-terminal-path.md`).
 *
 * `iceServers` are the STUN (or TURN) URLs both ends gather candidates with,
 * handed to the browser in `attached` and to the runner with the offer, so a
 * deployment changes them without a release. **Optional**: with none, both
 * ends offer host candidates only, which connects a browser on the same
 * machine or network as its host and leaves everyone else on the relay.
 */
const ICE_SERVER = /^(stun|turns?):[^\s,]+$/;

const entries = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const schema = z.object({
  // Checked whole, so a bad entry reports against the variable and not an index.
  iceServers: z
    .string()
    .optional()
    .refine((value) => entries(value).every((entry) => ICE_SERVER.test(entry)), {
      message: 'each ICE server is a stun:, turn: or turns: URL',
    })
    .refine((value) => entries(value).length <= 8, { message: 'at most 8 ICE servers' })
    .transform(entries),
  /**
   * Where sessions' previews live (`product/versions/mvp/28-session-previews.md`):
   * a scheme, a domain and an optional port, each preview a host under the
   * domain (`p5173-<session>.<domain>`). **Optional**: without it the console
   * offers no Browser tab. Never the console's own origin, and in production
   * a registrable domain of its own: a preview runs what the session's agent
   * wrote, and must not set a cookie the console reads.
   */
  previewBaseUrl: z
    .string()
    .url()
    .optional()
    .refine((value) => !value || new URL(value).pathname === '/', {
      message: 'a preview base URL is an origin, with no path',
    }),
  /**
   * The port the API serves previews on: a listener of their own, apart from
   * the API's, so a preview's requests never pass through the API's request
   * pipeline (`PreviewProxyGateway`). What fronts the deployment sends the
   * preview domain's wildcard here.
   */
  previewPort: positiveInt(3011),
});

export const relayConfig = registerAs('relay', () =>
  parseEnv('relay', schema, {
    iceServers: 'RELAY_ICE_SERVERS',
    previewBaseUrl: 'PREVIEW_BASE_URL',
    previewPort: 'PREVIEW_PORT',
  }),
);

/** Whether this deployment serves sessions' previews. */
export function previewsAreConfigured(config: ConfigService): boolean {
  return Boolean(config.get<string>('relay.previewBaseUrl'));
}
