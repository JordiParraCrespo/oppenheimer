import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/**
 * The relay's budgets: how long a runner has to introduce itself, and how much
 * a slow reader on either side may leave unread before it is dropped
 * (`product/versions/mvp/01-protocol.md`).
 *
 * **Defaulted, all of it.** What is not here on purpose: the link's ping
 * interval (a runner's heartbeat and a host's online window are both counted
 * from it), frame sizes and close codes (the runner holds the same numbers),
 * and the re-authorization minute (paired with the hosts module's owner
 * re-check).
 */
const schema = z.object({
  /** How long a runner has, after the socket upgrade, to send its hello. */
  helloTimeoutMs: positive(10_000),
  /** Bytes a runner's link may leave unread before it is closed as a slow consumer. */
  linkMaxBufferedBytes: positive(8 * 1024 * 1024),
  /** Bytes a browser's attachment may leave unread before it is dropped as a slow consumer. */
  browserMaxBufferedBytes: positive(4 * 1024 * 1024),
});

export type RelayConfig = z.infer<typeof schema>;

export const relayConfig = registerAs('relay', () =>
  parseEnv('relay', schema, {
    helloTimeoutMs: 'RELAY_HELLO_TIMEOUT_MS',
    linkMaxBufferedBytes: 'RELAY_LINK_MAX_BUFFERED_BYTES',
    browserMaxBufferedBytes: 'RELAY_BROWSER_MAX_BUFFERED_BYTES',
  }),
);
