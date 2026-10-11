import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

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
});

export const relayConfig = registerAs('relay', () =>
  parseEnv('relay', schema, {
    iceServers: 'RELAY_ICE_SERVERS',
  }),
);
